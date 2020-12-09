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
  startProcess: function* (quest, next) {
    yield backendRendererLock.lock(quest.goblin.id);
    quest.defer(() => backendRendererLock.unlock(quest.goblin.id));

    if (quest.goblin.getX('childProcess')) {
      return;
    }

    quest.log.dbg(`Starting: ${childModule}`);

    const xProcess = require('xcraft-core-process')({
      logger: 'xlog',
      resp: quest.resp,
    });

    const childProcess = xProcess.fork(childModule, childProcessOptions, next);

    const startResult = yield childProcess.once('message', next.arg(0));
    if (!startResult.started) {
      throw new Error(
        `Cannot start the backend renderer:\n${startResult.error.stack}`
      );
    }
    quest.goblin.setX('childProcess', childProcess);

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

  stopProcess: function (quest) {
    const childProcess = quest.goblin.getX('childProcess');
    if (!childProcess) {
      return;
    }
    quest.log.dbg(`Stopping: ${childModule}`);
    quest.goblin.setX('childProcess', null);
    childProcess.kill();
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
    if (!props) {
      props = {};
    }

    if (typeof props === 'string') {
      props = JSON.parse(props);
    }

    const renderFile = path.join(__dirname, 'child-renderer/render.js');
    const outputFilename = path.basename(renderFile);
    const outputPath = path.join(
      os.tmpdir(),
      '.cache/pack',
      path.dirname(renderFile)
    );
    const renderIndex = path.join(outputPath, outputFilename);

    yield quest.cmd('webpack.packli', {
      goblin: 'laboratory',
      mainGoblinModule: mainGoblin,
      jobId: uuidV4(),
      releasePath: projectPath,
      outputPath,
      options: {
        sourceMap: false,
        indexFile: path.relative(
          path.join(projectPath, 'node_modules'),
          renderFile
        ),
        outputFilename,
        target: 'node',
        alias: {
          _component:
            widgetPath || path.join(__dirname, 'child-renderer/_component.js'),
        },
      },
    });

    if (!quest.goblin.getX('childProcess')) {
      yield quest.me.startProcess();
    }

    const render = quest.goblin.getX('render');

    quest.log.dbg(`Rendering '${widgetPath}'...`);

    const result = yield render('component', {
      widgetPath,
      props,
      labId,
      state,
      renderIndex,
      forReact,
      themeContext,
      currentTheme,
    });
    quest.log.dbg(`Rendering done`);

    return result;
  },

  renderPDF: function* (quest, mainGoblin, documentPath, props, outputDir) {
    if (!props) {
      props = {};
    }

    if (typeof props === 'string') {
      props = JSON.parse(props);
    }

    const renderFile = path.join(__dirname, 'child-renderer/render.js');
    const outputFilename = path.basename(renderFile);
    const outputPath = path.join(
      os.tmpdir(),
      '.cache/pack',
      path.dirname(renderFile)
    );
    const renderIndex = path.join(outputPath, outputFilename);

    yield quest.cmd('webpack.packli', {
      goblin: 'laboratory',
      mainGoblinModule: mainGoblin,
      jobId: uuidV4(),
      releasePath: projectPath,
      outputPath,
      options: {
        sourceMap: false,
        indexFile: path.relative(
          path.join(projectPath, 'node_modules'),
          renderFile
        ),
        outputFilename,
        target: 'node',
        alias: {
          _component:
            documentPath ||
            path.join(__dirname, 'child-renderer/_component.js'),
        },
      },
    });

    if (!quest.goblin.getX('childProcess')) {
      yield quest.me.startProcess();
    }

    const render = quest.goblin.getX('render');

    quest.log.dbg(`Rendering '${documentPath}'...`);

    const result = yield render('pdf', {
      documentPath,
      props,
      outputDir,
      renderIndex,
    });
    quest.log.dbg(`Rendering done`);

    return result;
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
    outputName,
    next
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

    yield fs.writeFile(htmlFilePath, html, next);
    yield fs.writeFile(cssFilePath, css, next);

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
