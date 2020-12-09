import {combineReducers, createStore} from 'redux';
import widgetsReducer from 'goblin-laboratory/widgets/store/widgets-reducer.js';
// import commandsReducer from 'goblin-laboratory/widgets/store/commands-reducer.js';
import backendReducer from 'goblin-laboratory/widgets/store/backend-reducer.js';
import {fromJS} from 'immutable';

export default function configureStore(initialState) {
  const immutableInitialState = {};
  for (const [key, value] of Object.entries(initialState)) {
    immutableInitialState[key] = fromJS(value);
  }

  const reducers = combineReducers({
    widgets: widgetsReducer,
    // commands: commandsReducer,
    backend: backendReducer,
  });

  const store = createStore(reducers, immutableInitialState);

  return store;
}
