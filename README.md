# 📘 Documentation du module goblin-blacksmith

## Aperçu

Le module **goblin-blacksmith** est un moteur de rendu backend pour l'écosystème Xcraft. Il permet de générer du contenu HTML, CSS et PDF à partir de composants React côté serveur, sans interface utilisateur. Ce module est particulièrement utile pour la génération de rapports, d'exports PDF, et le rendu statique de composants pour l'optimisation SEO ou la mise en cache.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Configuration avancée](#configuration-avancée)
- [Détails des sources](#détails-des-sources)

## Structure du module

Le module s'organise autour de plusieurs composants clés :

- **Service principal** (`service.js`) : Acteur Goblin singleton qui orchestre le rendu
- **Processus enfant** (`child-renderer/`) : Environnement isolé pour le rendu React
- **Renderers spécialisés** : Moteurs de rendu pour différents formats (HTML, PDF)
- **Configuration** : Paramètres pour les répertoires de sortie et les renderers

## Fonctionnement global

Le module fonctionne selon une architecture de processus séparés :

1. **Processus principal** : L'acteur `blacksmith` reçoit les demandes de rendu
2. **Processus enfant** : Un processus Node.js isolé effectue le rendu React
3. **Communication IPC** : Les données transitent via des messages entre processus
4. **Compilation dynamique** : Webpack compile les composants à la demande
5. **Rendu statique** : Les composants React sont rendus en HTML/CSS statique

Le système utilise des verrous (mutex) pour éviter les conflits lors de rendus simultanés et met en cache les builds Webpack pour optimiser les performances.

### Architecture des processus

Le module utilise une approche multi-processus pour isoler le rendu :

- **Processus principal** : Gère les demandes et coordonne les rendus
- **Processus enfants** : Chaque composant peut avoir son propre processus de rendu
- **Verrous** : Système de mutex pour éviter les conflits de rendu simultanés
- **Cache** : Les builds Webpack sont mis en cache pour optimiser les performances

## Exemples d'utilisation

### Rendu d'un composant en HTML/CSS

```javascript
// Rendu d'un widget avec état Redux
const {html, css} = await this.quest.cmd('blacksmith.renderComponent', {
  mainGoblin: 'laboratory',
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
  mainGoblin: 'laboratory',
  documentPath: './documents/invoice/widget.js',
  props: {invoice: invoiceData},
  outputDir: '/tmp/invoices/invoice-123.pdf',
});
```

### Sauvegarde de composant en fichiers

```javascript
// Rendu et sauvegarde automatique
const {htmlFilePath, cssFilePath} = await this.quest.cmd(
  'blacksmith.renderComponentToFile',
  {
    mainGoblin: 'laboratory',
    widgetPath: './widgets/report/widget.js',
    props: {reportData},
    labId: 'lab@main',
    state: reduxState,
    outputDir: '/tmp/reports',
    outputName: 'monthly-report',
    isRoot: true,
  }
);
```

## Interactions avec d'autres modules

- **[goblin-laboratory]** : Fournit les composants Widget et le système de thèmes
- **[goblin-webpack]** : Compile les composants à la demande pour le rendu
- **[xcraft-core-process]** : Gère les processus enfants pour l'isolation
- **[xcraft-core-etc]** : Charge la configuration du module
- **[xcraft-core-fs]** : Opérations sur le système de fichiers

## Configuration avancée

| Option                | Description                                          | Type     | Valeur par défaut |
| --------------------- | ---------------------------------------------------- | -------- | ----------------- |
| `outputDir`           | Répertoire de sortie pour les renderers pré-compilés | `string` | `'blacksmith'`    |
| `renderers.component` | Liste des renderers de composants à construire       | `array`  | `[]`              |
| `renderers.root`      | Liste des renderers racine à construire              | `array`  | `[]`              |
| `renderers.pdf`       | Liste des renderers PDF à construire                 | `array`  | `[]`              |

### Variables d'environnement

| Variable           | Description                                           | Exemple            | Valeur par défaut        |
| ------------------ | ----------------------------------------------------- | ------------------ | ------------------------ |
| `NODE_ENV`         | Mode d'exécution, active le debugger en développement | `development`      | -                        |
| `BABEL_CACHE_PATH` | Chemin du cache Babel pour la compilation             | `/tmp/babel-cache` | `{xcraftRoot}/var/babel` |

## Détails des sources

### `service.js`

Acteur Goblin singleton qui orchestre tout le système de rendu. Il gère le cycle de vie des processus enfants, la compilation Webpack, et expose les méthodes de rendu publiques.

#### Cycle de vie de l'acteur

L'acteur `blacksmith` est créé en tant que singleton et reste actif pendant toute la durée de vie de l'application. Il maintient une collection de processus enfants et gère leur cycle de vie selon les besoins.

#### Méthodes publiques

- **`startProcess(id)`** — Démarre un processus enfant de rendu avec l'identifiant spécifié. Chaque processus est isolé et peut traiter des demandes de rendu. Utilise un verrou pour éviter les démarrages simultanés.
- **`stopProcess(id)`** — Arrête proprement un processus enfant spécifique et libère ses ressources. Le processus est retiré de la collection des processus actifs.
- **`restartProcesses()`** — Redémarre tous les processus enfants actifs, utile lors de mises à jour de code ou de configuration.
- **`build(backend, mainGoblin, componentPath, outputPath, outputFilename, publicPath, releasePath)`** — Compile un composant avec Webpack pour un backend spécifique (component, root, ou pdf). Génère un bundle optimisé pour le rendu côté serveur.
- **`renderComponent(mainGoblin, widgetPath, props, labId, state, forReact, themeContext, currentTheme, isRoot)`** — Rend un composant React en HTML/CSS statique avec support du state Redux et des thèmes. Utilise un verrou pour éviter les conflits de rendu.
- **`renderPDF(mainGoblin, documentPath, props, outputDir)`** — Génère un fichier PDF à partir d'un composant React PDF. Le processus enfant est automatiquement arrêté après le rendu pour éviter les fuites mémoire.
- **`renderComponentToFile(mainGoblin, widgetPath, props, labId, state, forReact, themeContext, currentTheme, outputDir, outputName, isRoot)`** — Rend un composant et sauvegarde automatiquement les fichiers HTML et CSS résultants dans le répertoire spécifié.

### `child-renderer/index.js`

Point d'entrée du processus enfant qui configure l'environnement de rendu et traite les messages IPC du processus principal. Il charge dynamiquement les renderers et gère les erreurs de rendu.

Le processus enfant :

- Configure l'environnement global pour React
- Écoute les messages du processus principal
- Charge dynamiquement le renderer approprié
- Retourne les résultats ou les erreurs via IPC

### `child-renderer/render.js`

Module principal du processus enfant qui configure l'environnement global pour React et expose la fonction de rendu universelle. Il supprime les références au DOM pour permettre le rendu côté serveur.

Fonctionnalités clés :

- Suppression de `global.window` avant l'import d'Aphrodite
- Configuration de l'environnement pour react-redux
- Exposition de la fonction `render` globale

### `child-renderer/renderStatic.js`

Utilitaire de rendu statique qui utilise Aphrodite pour extraire le CSS et ReactDOMServer pour générer le HTML. Il collecte également les styles injectés dynamiquement dans le document.

La fonction `renderStatic` :

- Utilise `StyleSheetServer.renderStatic` d'Aphrodite
- Supporte le rendu avec ou sans attributs React
- Collecte les styles additionnels du document simulé

### `child-renderer/setupGlobals.js`

Configure un environnement DOM simulé pour permettre l'exécution de composants React côté serveur. Il crée des objets `window`, `document`, et `navigator` minimaux.

Objets simulés :

- **`document`** : Avec `createElement`, `head`, et gestion des événements
- **`navigator`** : Avec support de la langue et de la plateforme
- **`window`** : Avec `location`, `history`, et référence au document

### `child-renderer/store.js`

Configure un store Redux pour le rendu avec les reducers de goblin-laboratory. Il convertit l'état initial en structures Immutable.js compatibles.

Reducers inclus :

- **`widgets`** : Gestion des états des widgets
- **`backend`** : Gestion des données backend
- Support des structures Immutable.js

### Fichiers spéciaux (renderers)

#### `renderers/component.js`

Renderer pour les composants standards avec support complet du state Redux, des thèmes, et du Frame de goblin-laboratory.

Fonctionnalités :

- Support du Frame pour l'injection du store Redux
- Gestion des thèmes et du contexte thématique
- Nettoyage du cache de styles avant chaque rendu
- Rendu avec ou sans état Redux

#### `renderers/pdf.js`

Renderer spécialisé pour la génération de PDF utilisant @react-pdf/renderer. Il traite les composants PDF et génère directement les fichiers de sortie.

Spécificités :

- Utilise `@react-pdf/renderer` pour la génération PDF
- Requiert un répertoire de sortie obligatoire
- Gestion d'erreurs spécifique aux documents PDF

#### `renderers/root.js`

Renderer pour les composants racine d'application, similaire au renderer de composant mais optimisé pour les éléments de plus haut niveau.

Différences avec le renderer de composant :

- Pas de support du Frame (le composant racine gère son propre store)
- Optimisé pour les composants de niveau application
- Nettoyage du cache de styles

---

_Document mis à jour_

[goblin-laboratory]: https://github.com/Xcraft-Inc/goblin-laboratory
[goblin-webpack]: https://github.com/Xcraft-Inc/goblin-webpack
[xcraft-core-process]: https://github.com/Xcraft-Inc/xcraft-core-process
[xcraft-core-etc]: https://github.com/Xcraft-Inc/xcraft-core-etc
[xcraft-core-fs]: https://github.com/Xcraft-Inc/xcraft-core-fs