'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');
const xHost = require('xcraft-core-host');
const xConfig = require('xcraft-core-etc')().load('xcraft');
const {mkdir} = require('xcraft-core-fs');
const uuidV4 = require('uuid/v4');
const watt = require('gigawatts');
const locks = require('xcraft-core-utils/lib/locks');
const backendRendererLock = locks.getMutex;

const logicState = {};
const logicHandlers = {};

const childModule = path.join(__dirname, 'child-renderer', 'index.js');

let projectPath = xHost.projectPath;
if (/[\\/]app\.asar[\\/]/.test(projectPath)) {
  projectPath = projectPath.replace(/app\.asar/, 'app.asar.unpacked');
}

const childProcessOptions = {
  cwd: projectPath,
  stdio: 'inherit',
  env: Object.assign(
    {
      BABEL_CACHE_PATH: path.join(xConfig.xcraftRoot, 'var/babel'),
    },
    process.env
  ),
};

if (process.env.NODE_ENV === 'development') {
  childProcessOptions.execArgv = ['--inspect=27773'];
}

const quests = {
  startProcess: function* (quest, id, next) {
    if (!id) {
      throw new Error('an id must be provided when starting a child process');
    }

    yield backendRendererLock.lock(quest.goblin.id);
    quest.defer(() => backendRendererLock.unlock(quest.goblin.id));

    if (quest.goblin.getX('childProcess')[id]) {
      return;
    }

    quest.log.dbg(`Starting: ${childModule}`);

    const xProcess = require('xcraft-core-process')({
      logger: 'xlog',
      resp: quest.resp,
    });

    const childProcess = xProcess.fork(
      childModule,
      [],
      childProcessOptions,
      next
    );

    const startResult = yield childProcess.once('message', next.arg(0));
    if (!startResult.started) {
      throw new Error(
        `Cannot start the backend renderer:\n${startResult.error.stack}`
      );
    }
    quest.goblin.getX('childProcess', {})[id] = childProcess;

    const results = {};
    childProcess.on('message', (msg) => {
      const requestId = msg.requestId;
      const result = results[requestId];
      if (result) {
        delete results[requestId];
        result(msg);
      }
    });

    const render = watt(function* (backend, args, next) {
      const requestId = uuidV4();
      results[requestId] = next.arg(0);
      childProcess.send({
        requestId,
        backend,
        args,
      });
      const msg = yield;
      if (msg.error) {
        throw new Error(`Backend renderer error:\n${msg.error.stack}`);
      }
      return msg.result;
    });
    quest.goblin.setX('render', render);
  },

  stopProcess: function (quest, id) {
    const childProcess = quest.goblin.getX('childProcess', {})[id];
    if (!childProcess) {
      return;
    }
    quest.log.dbg(`Stopping: ${childModule}`);
    delete quest.goblin.getX('childProcess')[id];
    childProcess.kill();
  },

  restartProcesses: function* (quest) {
    const childProcess = quest.goblin.getX('childProcess', {});
    for (const child in childProcess) {
      yield quest.me.stopProcess({id: child});
      yield quest.me.startProcess({id: child});
    }
  },

  build: function* (
    quest,
    backend,
    mainGoblin,
    componentPath,
    outputPath,
    outputFilename,
    releasePath = projectPath
  ) {
    let render;
    switch (backend) {
      case 'component':
        render = path.join(
          releasePath,
          'node_modules/goblin-blacksmith/lib/child-renderer/renderComponent.js'
        );
        break;
      case 'pdf':
        render = path.join(
          releasePath,
          'node_modules/goblin-blacksmith/lib/child-renderer/renderPDF.js'
        );
        break;
      default:
        throw new Error(
          `missing backend parameter, must be 'component' or 'pdf'`
        );
    }

    yield quest.cmd('webpack.pack', {
      goblin: 'laboratory',
      mainGoblinModule: mainGoblin,
      jobId: uuidV4(),
      releasePath,
      outputPath,
      options: {
        sourceMap: false,
        indexFile: path.relative(
          path.join(releasePath, 'node_modules'),
          path.join(
            releasePath,
            'node_modules/goblin-blacksmith/lib/child-renderer/render.js'
          )
        ),
        outputFilename,
        target: 'node',
        alias: {
          _component:
            componentPath ||
            path.join(
              releasePath,
              'node_modules/goblin-blacksmith/lib/child-renderer/_component.js'
            ),
          _render: render,
        },
      },
      withIndexHTML: false,
    });
  },

  *_renderIndex(quest, backend, mainGoblin, componentPath) {
    const xBlacksmithConfig = require('xcraft-core-etc')().load(
      'goblin-blacksmith'
    );

    if (xBlacksmithConfig && xBlacksmithConfig.renderers[backend]) {
      const filename = path.basename(componentPath);
      if (xBlacksmithConfig.renderers[backend][filename]) {
        const {resourcesPath} = xHost;
        const renderIndex = path.join(resourcesPath, 'blacksmith', filename);
        if (fs.existsSync(renderIndex)) {
          return [renderIndex, filename];
        }
      }
    }

    const filename = componentPath || 'void';
    const outputFilename = `render-${filename.replace(/[/\\]/g, '$')}`;
    const outputPath = path.join(
      os.tmpdir(),
      '.cache/pack',
      path.join(__dirname, 'child-renderer')
    );

    if (!quest.goblin.getX('built')) {
      quest.goblin.setX('built', {});
    }

    if (quest.goblin.getX('built')[outputFilename] !== true) {
      yield quest.me.build({
        backend,
        mainGoblin,
        componentPath,
        outputPath,
        outputFilename,
      });
      quest.goblin.getX('built')[outputFilename] = true;
    }

    return [path.join(outputPath, outputFilename), outputFilename];
  },

  _render: function* (quest, backend, mainGoblin, componentPath, props, args) {
    if (!props) {
      props = {};
    }

    if (typeof props === 'string') {
      props = JSON.parse(props);
    }

    const [renderIndex, outputFilename] = yield quest.me._renderIndex({
      backend,
      mainGoblin,
      componentPath,
    });

    if (!quest.goblin.getX('childProcess', {})[outputFilename]) {
      yield quest.me.startProcess({id: outputFilename});
      /* FIXME: stop to prevent leaks with PDF rendering (must be checked) */
      if (backend === 'pdf') {
        quest.defer(function* () {
          yield quest.me.stopProcess({id: outputFilename});
        });
      }
    }

    const render = quest.goblin.getX('render');

    quest.log.dbg(`Rendering '${componentPath}'...`);

    const result = yield render(backend, {
      componentPath,
      renderIndex,
      props,
      ...args,
    });
    quest.log.dbg(`Rendering done`);

    return result;
  },

  renderComponent: function* (
    quest,
    mainGoblin,
    widgetPath,
    props,
    labId,
    state,
    forReact,
    themeContext,
    currentTheme
  ) {
    return yield quest.me._render({
      backend: 'component',
      mainGoblin,
      componentPath: widgetPath,
      props,
      args: {labId, state, forReact, themeContext, currentTheme},
    });
  },

  renderPDF: function* (quest, mainGoblin, documentPath, props, outputDir) {
    yield backendRendererLock.lock(`${quest.goblin.id}.renderPDF`);
    quest.defer(() =>
      backendRendererLock.unlock(`${quest.goblin.id}.renderPDF`)
    );

    return yield quest.me._render({
      backend: 'pdf',
      mainGoblin,
      componentPath: documentPath,
      props,
      args: {outputDir},
    });
  },

  renderComponentToFile: function* (
    quest,
    mainGoblin,
    widgetPath,
    props,
    labId,
    state,
    forReact,
    themeContext,
    currentTheme,
    outputDir,
    outputName
  ) {
    const {html, css} = yield quest.me.renderComponent({
      mainGoblin,
      widgetPath,
      props,
      labId,
      state,
      forReact,
      themeContext,
      currentTheme,
    });

    mkdir(outputDir);

    const htmlFilePath = path.join(outputDir, `${outputName}.html`);
    const cssFilePath = path.join(outputDir, `${outputName}.css`);

    fs.writeFileSync(htmlFilePath, html);
    fs.writeFileSync(cssFilePath, css);

    return {htmlFilePath, cssFilePath};
  },
};

//-----------------------------------------------------------------------------

// Register all quests
for (const questName in quests) {
  Goblin.registerQuest(goblinName, questName, quests[questName]);
}

module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
Goblin.createSingle(goblinName);
