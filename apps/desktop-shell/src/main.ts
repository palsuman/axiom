import { registerNexusModuleAliases } from './runtime/nexus-module-alias';

registerNexusModuleAliases(__dirname);
require('./bootstrap/bootstrap-desktop-shell');
