import {AppRegistry} from 'react-native';
import App from '../App';
import {expo as appName} from 'Frontend/app.json';

AppRegistry.registerComponent(appName.name, () => App);