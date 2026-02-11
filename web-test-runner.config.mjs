import { esbuildPlugin } from "@web/dev-server-esbuild";

// none work... but are these good ideas to use to resolve?
// import { importMapsPlugin } from '@web/dev-server-import-maps';
//
// import rollupReplace from '@rollup/plugin-replace';
// import { fromRollup } from '@web/dev-server-rollup';

export default {
  plugins: [esbuildPlugin({
    ts: true, tsconfig: './tsconfig.json' 
  })],
  // manual: true
};
