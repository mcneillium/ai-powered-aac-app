import { registerRootComponent } from 'expo';


// Add React Native polyfills and environment setup before importing any Firebase code
global.indexedDB = null;
global.localStorage = null;
global.sessionStorage = null;
global.webkitIndexedDB = null;
global.mozIndexedDB = null;
global.msIndexedDB = null;
global.shimIndexedDB = null;

// Now import your main app
import App from './App';
export default App;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
