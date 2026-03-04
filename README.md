# 📘 goblin-blacksmith

## Aperçu

Le module **goblin-blacksmith** est un moteur de rendu backend pour l'écosystème Xcraft. Il permet de générer du contenu HTML, CSS et PDF à partir de composants React côté serveur, sans interface utilisateur. Ce module est particulièrement utile pour la génération de rapports, d'exports PDF, et le rendu statique de composants pour la mise en cache ou l'intégration dans des flux de traitement automatisés.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Configuration avancée](#configuration-avancée)
- [Détails des sources](#détails-des-sources)
- [Licence](#licence)

## Structure du module

Le module s'organise autour de plusieurs composants clés :

- **Service principal** (`lib/service.js`) : Acteur Goblin singleton qui orchestre le rendu
- **Processus enfant** (`lib/child-renderer/`) : Environnement isolé pour l'exécution du rendu React
- **Renderers spécialisés** (`lib/child-renderer/renderers/`) : Moteurs de rendu pour les formats HTML/CSS et PDF
- **Configuration** (`config.js`) : Paramètres pour les répertoires de sortie et les renderers pré-compilés

## Fonctionnement global

Le module fonctionne selon une architecture de processus séparés :

1. **Processus principal** : L'acteur `blacksmith` reçoit les demandes de rendu via le bus Xcraft
2. **Compilation Webpack** : Si nécessaire, un bundle est compilé dynamiquement via `goblin-webpack`
3. **Processus enfant** : Un processus Node.js isolé (`child-renderer/index.js`) exécute le rendu React
4. **Communication IPC** : Les demandes et résultats transitent par messages entre processus via `requestId`
5. **Rendu statique** : Les composants React sont rendus en HTML/CSS statique ou en PDF

Le système utilise des verrous mutex pour sérialiser les rendus simultanés et met en cache les builds Webpack pour optimiser les performances.

### Architecture des processus

```
Processus principal (blacksmith)
│
├── backendRendererLock (mutex)
│
├── _renderIndex() ──► Webpack build (si nécessaire)
│
└── _render()
      │
      └── startProcess(outputFilename)
            │
            └── child-renderer/index.js (processus enfant)
                  │
                  ├── IPC message: {requestId, backend, args}
                  │
                  └── render(backend, args)
                        ├── renderers/component.js
                        ├── renderers/root.js
                        └── renderers/pdf.js
```

Le processus enfant est identifié par le nom du fichier de bundle (`outputFilename`), ce qui permet d'avoir un processus dédié par composant compilé. Pour le rendu PDF, le processus enfant est systématiquement arrêté après chaque rendu afin d'éviter les fuites mémoire.

## Exemples d'utilisation

### Rendu d'un composant en HTML/CSS

```javascript
// Rendu d'un widget avec état Redux
const {html, css} = await this.quest.cmd('blacksmith.renderComponent', {
  mainGoblin: 'my-app',
  widgetPath: './widgets/my-component/widget.js',
  props: {title: 'Mon titre', data: myData},
  labId: 'lab@main',
  state: reduxState,
  forReact: false,
  themeContext: themeContext,
  currentTheme: 'default',
});
```

### Génération d'un PDF

```javascript
// Rendu d'un document PDF
await this.quest.cmd('blacksmith.renderPDF', {
  mainGoblin: 'my-app',
  documentPath: './documents/invoice/widget.js',
  props: {invoice: invoiceData},
  outputDir: '/tmp/invoices/invoice-123.pdf',
});
```

### Sauvegarde d'un composant en fichiers HTML/CSS

```javascript
// Rendu et sauvegarde automatique
const {htmlFilePath, cssFilePath} = await this.quest.cmd(
  'blacksmith.renderComponentToFile',
  {
    mainGoblin: 'my-app',
    widgetPath: './widgets/report/widget.js',
    props: {reportData},
    labId: 'lab@main',
    state: reduxState,
    outputDir: '/tmp/reports',
    outputName: 'monthly-report',
    isRoot: false,
  }
);
```

### Rendu d'un composant racine

```javascript
// Rendu d'un composant racine d'application (isRoot: true)
const {html, css} = await this.quest.cmd('blacksmith.renderComponent', {
  mainGoblin: 'my-app',
  widgetPath: './widgets/app-root/widget.js',
  props: {},
  labId: 'lab@main',
  state: reduxState,
  isRoot: true,
});
```

## Interactions avec d'autres modules

- **[goblin-laboratory]** : Fournit les composants `Frame`, `Widget`, le store Redux et le système de thèmes utilisés par les renderers
- **[goblin-webpack]** : Compile les composants à la demande via la commande `webpack.pack` pour générer les bundles de rendu
- **[xcraft-core-process]** : Gère le fork et la communication avec les processus enfants
- **[xcraft-core-etc]** : Charge la configuration du module (`goblin-blacksmith` et `xcraft`)
- **[xcraft-core-fs]** : Opérations sur le système de fichiers (création de répertoires)
- **[xcraft-core-host]** : Fournit les chemins `projectPath` et `resourcesPath` pour localiser les ressources
- **[xcraft-core-utils]** : Fournit le système de verrous mutex (`locks.getMutex`)

## Configuration avancée

| Option                | Description                                          | Type     | Valeur par défaut |
| --------------------- | ---------------------------------------------------- | -------- | ----------------- |
| `outputDir`           | Répertoire de sortie pour les renderers pré-compilés | `string` | `'blacksmith'`    |
| `renderers.component` | Liste des renderers de composants à pré-construire   | `array`  | `[]`              |
| `renderers.root`      | Liste des renderers racine à pré-construire          | `array`  | `[]`              |
| `renderers.pdf`       | Liste des renderers PDF à pré-construire             | `array`  | `[]`              |

Lorsqu'un renderer est pré-compilé et référencé dans la configuration, le module recherche d'abord un fichier de bundle dans `{resourcesPath}/{outputDir}/.{filename}` avant de lancer une compilation Webpack à la volée.

### Variables d'environnement

| Variable           | Description                                                     | Exemple            | Valeur par défaut        |
| ------------------ | --------------------------------------------------------------- | ------------------ | ------------------------ |
| `NODE_ENV`         | Mode d'exécution ; active le débogueur Node.js en développement | `development`      | —                        |
| `BABEL_CACHE_PATH` | Chemin du cache Babel pour la compilation Webpack               | `/tmp/babel-cache` | `{xcraftRoot}/var/babel` |

En mode `development`, le processus enfant est démarré avec l'option `--inspect=27773` pour permettre l'attachement d'un débogueur.

## Détails des sources

### `lib/service.js`

Acteur Goblin singleton qui orchestre tout le système de rendu. Il gère le cycle de vie des processus enfants, la compilation Webpack et expose les méthodes de rendu publiques sur le bus Xcraft.

#### Cycle de vie de l'acteur

L'acteur `blacksmith` est créé en tant que singleton (`Goblin.createSingle`) et reste actif pendant toute la durée de vie de l'application. Il ne possède pas de logique d'état Redux (`logicState` et `logicHandlers` sont vides) ; toute la gestion d'état se fait via les données transientes (`getX`/`setX`).

Il maintient en données transientes :

- **`childProcess`** : Map des processus enfants actifs, indexés par `outputFilename`
- **`render`** : Fonction watt de communication IPC vers le processus enfant courant
- **`built`** : Map des bundles Webpack déjà compilés

#### Méthodes publiques

- **`startProcess(id)`** — Démarre un processus enfant de rendu identifié par `id`. Utilise un verrou pour éviter les démarrages simultanés. Envoie les requêtes de rendu via IPC et achemine les réponses grâce à une map de callbacks indexée par `requestId`.

- **`stopProcess(id)`** — Arrête proprement le processus enfant associé à `id` et le retire de la map des processus actifs.

- **`restartProcesses()`** — Redémarre tous les processus enfants actifs séquentiellement, utile après une mise à jour de code ou de configuration.

- **`build(backend, mainGoblin, componentPath, outputPath, outputFilename, publicPath, releasePath)`** — Compile un composant avec Webpack pour un backend spécifique (`component`, `root` ou `pdf`). Le point d'entrée est toujours `child-renderer/render.js` avec des alias `_component` et `_render` injectés dynamiquement. La cible de compilation est `node`.

- **`renderComponent(mainGoblin, widgetPath, props, labId, state, forReact, themeContext, currentTheme, isRoot=false)`** — Rend un composant React en HTML/CSS statique. Utilise le renderer `root` si `isRoot` est `true`, sinon `component`. Protégé par un verrou mutex.

- **`renderPDF(mainGoblin, documentPath, props, outputDir)`** — Génère un fichier PDF à partir d'un composant React PDF. Le processus enfant est automatiquement arrêté après le rendu (`quest.defer`) pour prévenir les fuites mémoire.

- **`renderComponentToFile(mainGoblin, widgetPath, props, labId, state, forReact, themeContext, currentTheme, outputDir, outputName, isRoot=false)`** — Rend un composant et sauvegarde les fichiers `{outputName}.html` et `{outputName}.css` dans `outputDir`. Retourne les chemins des fichiers générés.

### `lib/child-renderer/index.js`

Point d'entrée du processus enfant. Il configure l'environnement global via `setupGlobals`, puis écoute les messages IPC du processus principal. Pour chaque message reçu, il charge dynamiquement le bundle via `require(args.renderIndex)` (ce qui expose `global.render`), exécute le rendu et retourne le résultat ou l'erreur sérialisée.

Lors du démarrage réussi, il envoie `{started: true}` au processus parent. En cas d'échec lors de l'initialisation, il envoie `{started: false, error: ...}`.

### `lib/child-renderer/render.js`

Module principal du bundle Webpack généré pour le processus enfant. Il orchestre les imports dans le bon ordre pour éviter les problèmes de détection d'environnement :

1. Suppression de `global.window` avant l'import d'`aphrodite` (qui détecte le navigateur via `global.window`)
2. Import de `react-redux` (qui détecte le navigateur via `window.document.createElement`)
3. Appel de `setupGlobals()` pour recréer un environnement DOM simulé
4. Exposition de `global.render` qui délègue au renderer spécifique (`_render`)

### `lib/child-renderer/renderStatic.js`

Utilitaire de rendu statique combinant Aphrodite et ReactDOMServer.

**`renderStatic(element, forReact=false)`** — Rend un élément React en HTML statique et extrait le CSS généré par Aphrodite. Collecte également les styles injectés dans `global.document.head` par d'autres mécanismes. Le paramètre `forReact` bascule entre `renderToString` (avec attributs React pour l'hydratation) et `renderToStaticMarkup` (HTML pur).

### `lib/child-renderer/setupGlobals.js`

Configure un environnement DOM minimal pour permettre l'exécution de bibliothèques React dans un contexte Node.js. Crée les objets globaux `document`, `navigator` et `window` avec les propriétés minimales nécessaires.

Objets simulés :

- **`document`** : Avec `createElement`, gestion du `head` (pour la collecte des styles) et des événements
- **`navigator`** : Avec `platform`, `userAgent` et `language` (configurable, défaut `fr-CH`)
- **`window`** : Avec `screen`, `location`, `history`, `isBrowser: true` et références croisées

### `lib/child-renderer/store.js`

Configure un store Redux pour le rendu avec les reducers de [goblin-laboratory]. Convertit l'état initial en structures Immutable.js via `fromJS` avant de créer le store.

Reducers inclus :

- **`widgets`** : Gestion des états des widgets (depuis `goblin-laboratory`)
- **`backend`** : Gestion des données backend (depuis `goblin-laboratory`)

### Fichiers spéciaux (renderers)

#### `lib/child-renderer/renderers/component.js`

Renderer pour les composants standards. Si un `state` Redux est fourni, le composant est enveloppé dans un `Frame` de [goblin-laboratory] qui injecte le store, le thème et le contexte thématique. Sans état, le composant est rendu directement. Le cache de styles est vidé avant chaque rendu via `clearStylesCache`.

#### `lib/child-renderer/renderers/pdf.js`

Renderer spécialisé pour la génération de PDF utilisant `@react-pdf/renderer`. Requiert un `outputDir` obligatoire (chemin complet du fichier PDF de sortie). Utilise `ReactPDF.render` pour générer directement le fichier.

#### `lib/child-renderer/renderers/root.js`

Renderer pour les composants racine d'application. Contrairement au renderer `component`, il ne passe pas par `Frame` : le composant racine reçoit directement le store Redux et le `labId` comme props. Le cache de styles est vidé avant chaque rendu.

## Licence

Ce module est distribué sous [licence MIT](./LICENSE).

---

_Ce contenu a été généré par IA_

[goblin-laboratory]: https://github.com/Xcraft-Inc/goblin-laboratory
[goblin-webpack]: https://github.com/Xcraft-Inc/goblin-webpack
[xcraft-core-process]: https://github.com/Xcraft-Inc/xcraft-core-process
[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
[xcraft-core-fs]: https://github.com/Xcraft-Inc/xcraft-core-fs
[xcraft-core-host]: https://github.com/Xcraft-Inc/xcraft-core-host
[xcraft-core-utils]: https://github.com/Xcraft-Inc/xcraft-core-utils
