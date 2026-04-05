# Third-Party Notices

This file documents third-party software packages and non-code assets found in this repository.

Scope:
- Direct runtime and development dependencies from `package.json`
- Installed npm packages resolved in `package-lock.json` and present under `node_modules`
- Binary/media assets tracked in this repository that may require separate provenance or license review

Important:
- Most npm packages below are open-source and can usually be used commercially subject to their license terms.
- Binary audio/image/model assets in this repository may require separate proof of origin, attribution, or commercial-use rights.
- This file is an inventory, not legal advice.

## License Summary For Installed npm Packages

| License | Package Count |
| --- | ---: |
| MIT | 513 |
| ISC | 31 |
| Apache-2.0 | 9 |
| BSD-3-Clause | 9 |
| BSD-2-Clause | 2 |
| MIT-0 | 2 |
| BlueOak-1.0.0 | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |
| SEE LICENSE IN https://www.photonengine.com/terms | 1 |

## Direct Runtime Dependencies

| Package | Version | License | Repository |
| --- | --- | --- | --- |
| lucide-react | 0.400.0 | ISC | https://github.com/lucide-icons/lucide.git |
| peerjs | 1.5.5 | MIT | https://github.com/peers/peerjs |
| photon-realtime | 4.4.0 | SEE LICENSE IN https://www.photonengine.com/terms |  |
| react | 18.3.1 | MIT | https://github.com/facebook/react.git |
| react-dom | 18.3.1 | MIT | https://github.com/facebook/react.git |
| react-markdown | 10.1.0 | MIT | remarkjs/react-markdown |
| remark-breaks | 4.0.0 | MIT | remarkjs/remark-breaks |
| remark-gfm | 4.0.1 | MIT | remarkjs/remark-gfm |
| three | 0.183.0 | MIT | https://github.com/mrdoob/three.js |

## Direct Development Dependencies

| Package | Version | License | Repository |
| --- | --- | --- | --- |
| @testing-library/jest-dom | 6.9.1 | MIT | https://github.com/testing-library/jest-dom |
| @testing-library/react | 16.3.2 | MIT | https://github.com/testing-library/react-testing-library |
| @testing-library/user-event | 14.6.1 | MIT | https://github.com/testing-library/user-event |
| @types/react | 18.3.27 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/react-dom | 18.3.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/three | 0.183.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @vitejs/plugin-react | 4.7.0 | MIT | https://github.com/vitejs/vite-plugin-react.git |
| @vitest/coverage-v8 | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| autoprefixer | 10.4.23 | MIT | postcss/autoprefixer |
| jsdom | 28.1.0 | MIT | https://github.com/jsdom/jsdom.git |
| peer | 1.0.2 | MIT | https://github.com/peers/peerjs-server |
| postcss | 8.5.6 | MIT | postcss/postcss |
| prettier | 3.8.1 | MIT | prettier/prettier |
| tailwindcss | 3.4.19 | MIT | https://github.com/tailwindlabs/tailwindcss.git#v3 |
| typescript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript.git |
| vite | 4.5.14 | MIT | https://github.com/vitejs/vite.git |
| vitest | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |

## Repository Binary And Media Assets Requiring Separate Review

### Web build assets under `public/`

- `public/background-music.mp3`
- `public/lobby-bgm.mp3`
- `public/the-final-boss-battle-158700.mp3`
- `public/sfx/attack.wav`
- `public/sfx/click.wav`
- `public/sfx/defeat.wav`
- `public/sfx/error.wav`
- `public/sfx/mine-hit.wav`
- `public/sfx/place-mine.wav`
- `public/sfx/victory.wav`

Notes:
- These files are not covered by npm package licenses.
- The repository currently does not include origin or commercial-use proof for these audio files.

### Legacy Unity assets present in repository

- `My project/` contains Unity project assets, including third-party materials and generated platform build output.
- `My project/Assets/unity-chan!` contains Unity-Chan assets with their own license documents.
- `My project/Assets/unity-chan!/Unity-chan! Model/Documentation/UnityChanLicense2.0/English/01Unity-Chan License Terms and Condition_EN_UCL2.0.pdf`
- `My project/Assets/unity-chan!/Unity-chan! Model/Documentation/UnityChanLicense2.0/English/02Unity-Chan License Terms and Condition_Summary_EN_UCL2.0.pdf`
- `My project/Assets/unity-chan!/Unity-chan! Model/Documentation/UnityChanLicense2.0/English/03Indication of License_EN_UCL2.0.pdf`

Notes:
- These Unity assets are not referenced by the current web `src/` build, but they remain in the repository.
- If any Unity asset is redistributed, shipped, shown in promotional media, or reused later, its license terms should be reviewed separately.

### Other tracked binary assets

- `Ratio Studio Logo.png`

Notes:
- If this logo was commissioned, generated, or obtained from a third party, keep the relevant usage rights or assignment documentation.

## Full Installed npm Package Inventory

| Package | Version | License | Repository |
| --- | --- | --- | --- |
| @acemir/cssom | 0.9.31 | MIT | acemir/CSSOM |
| @adobe/css-tools | 4.4.4 | MIT | https://github.com/adobe/css-tools.git |
| @alloc/quick-lru | 5.2.0 | MIT | sindresorhus/quick-lru |
| @ampproject/remapping | 2.3.0 | Apache-2.0 | https://github.com/ampproject/remapping.git |
| @asamuzakjp/css-color | 5.0.1 | MIT | https://github.com/asamuzaK/cssColor.git |
| @asamuzakjp/dom-selector | 6.8.1 | MIT | https://github.com/asamuzaK/domSelector.git |
| @asamuzakjp/nwsapi | 2.3.9 | MIT | git://github.com/dperini/nwsapi.git |
| @babel/code-frame | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/compat-data | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/core | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/generator | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/helper-compilation-targets | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/helper-globals | 7.28.0 | MIT | https://github.com/babel/babel.git |
| @babel/helper-module-imports | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/helper-module-transforms | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/helper-plugin-utils | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/helper-string-parser | 7.27.1 | MIT | https://github.com/babel/babel.git |
| @babel/helper-validator-identifier | 7.28.5 | MIT | https://github.com/babel/babel.git |
| @babel/helper-validator-option | 7.27.1 | MIT | https://github.com/babel/babel.git |
| @babel/helpers | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/parser | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/plugin-transform-react-jsx-self | 7.27.1 | MIT | https://github.com/babel/babel.git |
| @babel/plugin-transform-react-jsx-source | 7.27.1 | MIT | https://github.com/babel/babel.git |
| @babel/runtime | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/template | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/traverse | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @babel/types | 7.28.6 | MIT | https://github.com/babel/babel.git |
| @bcoe/v8-coverage | 0.2.3 | MIT | git://github.com/demurgos/v8-coverage.git |
| @bramus/specificity | 2.4.2 | MIT | https://github.com/bramus/specificity.git |
| @csstools/color-helpers | 6.0.2 | MIT-0 | https://github.com/csstools/postcss-plugins.git |
| @csstools/css-calc | 3.1.1 | MIT | https://github.com/csstools/postcss-plugins.git |
| @csstools/css-color-parser | 4.0.2 | MIT | https://github.com/csstools/postcss-plugins.git |
| @csstools/css-parser-algorithms | 4.0.0 | MIT | https://github.com/csstools/postcss-plugins.git |
| @csstools/css-syntax-patches-for-csstree | 1.0.28 | MIT-0 | https://github.com/csstools/postcss-plugins.git |
| @csstools/css-tokenizer | 4.0.0 | MIT | https://github.com/csstools/postcss-plugins.git |
| @dimforge/rapier3d-compat | 0.12.0 | Apache-2.0 | https://github.com/dimforge/rapier.js |
| @esbuild/win32-x64 | 0.18.20 | MIT | https://github.com/evanw/esbuild |
| @esbuild/win32-x64 | 0.21.5 | MIT | https://github.com/evanw/esbuild.git |
| @exodus/bytes | 1.14.1 | MIT | https://github.com/ExodusOSS/bytes.git |
| @istanbuljs/schema | 0.1.3 | MIT | https://github.com/istanbuljs/schema.git |
| @jest/schemas | 29.6.3 | MIT | https://github.com/jestjs/jest.git |
| @jridgewell/gen-mapping | 0.3.13 | MIT | https://github.com/jridgewell/sourcemaps.git |
| @jridgewell/remapping | 2.3.5 | MIT | https://github.com/jridgewell/sourcemaps.git |
| @jridgewell/resolve-uri | 3.1.2 | MIT | https://github.com/jridgewell/resolve-uri |
| @jridgewell/sourcemap-codec | 1.5.5 | MIT | https://github.com/jridgewell/sourcemaps.git |
| @jridgewell/trace-mapping | 0.3.31 | MIT | https://github.com/jridgewell/sourcemaps.git |
| @msgpack/msgpack | 2.8.0 | ISC | https://github.com/msgpack/msgpack-javascript.git |
| @nodelib/fs.scandir | 2.1.5 | MIT | https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir |
| @nodelib/fs.stat | 2.0.5 | MIT | https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat |
| @nodelib/fs.walk | 1.2.8 | MIT | https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk |
| @rolldown/pluginutils | 1.0.0-beta.27 | MIT | https://github.com/rolldown/rolldown.git |
| @rollup/rollup-win32-x64-gnu | 4.57.1 | MIT | https://github.com/rollup/rollup.git |
| @rollup/rollup-win32-x64-msvc | 4.57.1 | MIT | https://github.com/rollup/rollup.git |
| @sinclair/typebox | 0.27.10 | MIT | https://github.com/sinclairzx81/typebox-legacy |
| @testing-library/dom | 10.4.1 | MIT | https://github.com/testing-library/dom-testing-library |
| @testing-library/jest-dom | 6.9.1 | MIT | https://github.com/testing-library/jest-dom |
| @testing-library/react | 16.3.2 | MIT | https://github.com/testing-library/react-testing-library |
| @testing-library/user-event | 14.6.1 | MIT | https://github.com/testing-library/user-event |
| @tweenjs/tween.js | 23.1.3 | MIT | https://github.com/tweenjs/tween.js.git |
| @types/aria-query | 5.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/babel__core | 7.20.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/babel__generator | 7.27.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/babel__template | 7.4.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/babel__traverse | 7.28.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/body-parser | 1.19.6 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/connect | 3.4.38 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/debug | 4.1.12 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/estree | 1.0.8 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/estree-jsx | 1.0.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/express | 4.17.25 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/express-serve-static-core | 4.19.8 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/hast | 3.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/http-errors | 2.0.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/mdast | 4.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/mime | 1.3.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/ms | 2.1.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/node | 25.2.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/prop-types | 15.7.15 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/qs | 6.14.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/range-parser | 1.2.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/react | 18.3.27 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/react-dom | 18.3.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/send | 0.17.6 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/send | 1.2.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/serve-static | 1.15.10 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/stats.js | 0.17.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/three | 0.183.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/unist | 2.0.11 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/unist | 3.0.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/webxr | 0.5.24 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @types/ws | 8.18.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| @ungap/structured-clone | 1.3.0 | ISC | https://github.com/ungap/structured-clone.git |
| @vitejs/plugin-react | 4.7.0 | MIT | https://github.com/vitejs/vite-plugin-react.git |
| @vitest/coverage-v8 | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| @vitest/expect | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| @vitest/runner | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| @vitest/snapshot | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| @vitest/spy | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| @vitest/utils | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| @webgpu/types | 0.1.69 | BSD-3-Clause | gpuweb/types |
| accepts | 1.3.8 | MIT | jshttp/accepts |
| acorn | 8.15.0 | MIT | https://github.com/acornjs/acorn.git |
| acorn-walk | 8.3.4 | MIT | https://github.com/acornjs/acorn.git |
| agent-base | 7.1.4 | MIT | https://github.com/TooTallNate/proxy-agents.git |
| aix-ppc64 | 0.21.5 | MIT |  |
| android-arm | 0.18.20 | MIT |  |
| android-arm | 0.21.5 | MIT |  |
| android-arm64 | 0.18.20 | MIT |  |
| android-arm64 | 0.21.5 | MIT |  |
| android-x64 | 0.18.20 | MIT |  |
| android-x64 | 0.21.5 | MIT |  |
| ansi-regex | 5.0.1 | MIT | chalk/ansi-regex |
| ansi-styles | 4.3.0 | MIT | chalk/ansi-styles |
| ansi-styles | 5.2.0 | MIT | chalk/ansi-styles |
| any-promise | 1.3.0 | MIT | https://github.com/kevinbeaty/any-promise |
| anymatch | 3.1.3 | ISC | https://github.com/micromatch/anymatch |
| arg | 5.0.2 | MIT | vercel/arg |
| aria-query | 5.3.0 | Apache-2.0 | https://github.com/A11yance/aria-query.git |
| array-flatten | 1.1.1 | MIT | git://github.com/blakeembrey/array-flatten.git |
| assertion-error | 1.1.0 | MIT | git@github.com:chaijs/assertion-error.git |
| autoprefixer | 10.4.23 | MIT | postcss/autoprefixer |
| bail | 2.0.2 | MIT | wooorm/bail |
| balanced-match | 1.0.2 | MIT | git://github.com/juliangruber/balanced-match.git |
| baseline-browser-mapping | 2.9.18 | Apache-2.0 | https://github.com/web-platform-dx/baseline-browser-mapping.git |
| bidi-js | 1.0.3 | MIT | https://github.com/lojjic/bidi-js.git |
| binary-extensions | 2.3.0 | MIT | sindresorhus/binary-extensions |
| body-parser | 1.20.4 | MIT | expressjs/body-parser |
| brace-expansion | 1.1.12 | MIT | git://github.com/juliangruber/brace-expansion.git |
| braces | 3.0.3 | MIT | micromatch/braces |
| browserslist | 4.28.1 | MIT | browserslist/browserslist |
| bytes | 3.1.2 | MIT | visionmedia/bytes.js |
| cac | 6.7.14 | MIT | egoist/cac |
| call-bind-apply-helpers | 1.0.2 | MIT | https://github.com/ljharb/call-bind-apply-helpers.git |
| call-bound | 1.0.4 | MIT | https://github.com/ljharb/call-bound.git |
| camelcase-css | 2.0.1 | MIT | stevenvachon/camelcase-css |
| caniuse-lite | 1.0.30001766 | CC-BY-4.0 | browserslist/caniuse-lite |
| ccount | 2.0.1 | MIT | wooorm/ccount |
| chai | 4.5.0 | MIT | https://github.com/chaijs/chai |
| character-entities | 2.0.2 | MIT | wooorm/character-entities |
| character-entities-html4 | 2.1.0 | MIT | wooorm/character-entities-html4 |
| character-entities-legacy | 3.0.0 | MIT | wooorm/character-entities-legacy |
| character-reference-invalid | 2.0.1 | MIT | wooorm/character-reference-invalid |
| check-error | 1.0.3 | MIT | ssh://git@github.com/chaijs/check-error.git |
| chokidar | 3.6.0 | MIT | https://github.com/paulmillr/chokidar.git |
| cliui | 8.0.1 | ISC | yargs/cliui |
| color-convert | 2.0.1 | MIT | Qix-/color-convert |
| color-name | 1.1.4 | MIT | git@github.com:colorjs/color-name.git |
| comma-separated-tokens | 2.0.3 | MIT | wooorm/comma-separated-tokens |
| commander | 4.1.1 | MIT | https://github.com/tj/commander.js.git |
| concat-map | 0.0.1 | MIT | git://github.com/substack/node-concat-map.git |
| confbox | 0.1.8 | MIT | unjs/confbox |
| content-disposition | 0.5.4 | MIT | jshttp/content-disposition |
| content-type | 1.0.5 | MIT | jshttp/content-type |
| convert-source-map | 2.0.0 | MIT | git://github.com/thlorenz/convert-source-map.git |
| cookie | 0.7.2 | MIT | jshttp/cookie |
| cookie-signature | 1.0.7 | MIT | https://github.com/visionmedia/node-cookie-signature.git |
| cors | 2.8.6 | MIT | expressjs/cors |
| cross-spawn | 7.0.6 | MIT | git@github.com:moxystudio/node-cross-spawn.git |
| css-tree | 3.1.0 | MIT | csstree/csstree |
| css.escape | 1.5.1 | MIT | https://github.com/mathiasbynens/CSS.escape.git |
| cssesc | 3.0.0 | MIT | https://github.com/mathiasbynens/cssesc.git |
| cssstyle | 6.1.0 | MIT | https://github.com/jsdom/cssstyle.git |
| csstype | 3.2.3 | MIT | https://github.com/frenic/csstype |
| darwin-arm64 | 0.18.20 | MIT |  |
| darwin-arm64 | 0.21.5 | MIT |  |
| darwin-x64 | 0.18.20 | MIT |  |
| darwin-x64 | 0.21.5 | MIT |  |
| data-uri-to-buffer | 4.0.1 | MIT | git://github.com/TooTallNate/node-data-uri-to-buffer.git |
| data-urls | 7.0.0 | MIT | https://github.com/jsdom/data-urls.git |
| debug | 2.6.9 | MIT | git://github.com/visionmedia/debug.git |
| debug | 4.4.3 | MIT | git://github.com/debug-js/debug.git |
| decimal.js | 10.6.0 | MIT | https://github.com/MikeMcl/decimal.js.git |
| decode-named-character-reference | 1.3.0 | MIT | wooorm/decode-named-character-reference |
| deep-eql | 4.1.4 | MIT | git@github.com:chaijs/deep-eql.git |
| depd | 2.0.0 | MIT | dougwilson/nodejs-depd |
| dequal | 2.0.3 | MIT | lukeed/dequal |
| destroy | 1.2.0 | MIT | stream-utils/destroy |
| devlop | 1.1.0 | MIT | wooorm/devlop |
| didyoumean | 1.2.2 | Apache-2.0 | https://github.com/dcporter/didyoumean.js.git |
| diff-sequences | 29.6.3 | MIT | https://github.com/jestjs/jest.git |
| dlv | 1.1.3 | MIT | developit/dlv |
| dom-accessibility-api | 0.5.16 | MIT | https://github.com/eps1lon/dom-accessibility-api.git |
| dom-accessibility-api | 0.6.3 | MIT | https://github.com/eps1lon/dom-accessibility-api.git |
| dunder-proto | 1.0.1 | MIT | https://github.com/es-shims/dunder-proto.git |
| ee-first | 1.1.1 | MIT | jonathanong/ee-first |
| electron-to-chromium | 1.5.278 | ISC | https://github.com/kilian/electron-to-chromium/ |
| emoji-regex | 8.0.0 | MIT | https://github.com/mathiasbynens/emoji-regex.git |
| encodeurl | 2.0.0 | MIT | pillarjs/encodeurl |
| entities | 6.0.1 | BSD-2-Clause | git://github.com/fb55/entities.git |
| es-define-property | 1.0.1 | MIT | https://github.com/ljharb/es-define-property.git |
| es-errors | 1.3.0 | MIT | https://github.com/ljharb/es-errors.git |
| es-object-atoms | 1.1.1 | MIT | https://github.com/ljharb/es-object-atoms.git |
| esbuild | 0.18.20 | MIT | https://github.com/evanw/esbuild |
| esbuild | 0.21.5 | MIT | https://github.com/evanw/esbuild.git |
| escalade | 3.2.0 | MIT | lukeed/escalade |
| escape-html | 1.0.3 | MIT | component/escape-html |
| escape-string-regexp | 5.0.0 | MIT | sindresorhus/escape-string-regexp |
| estree-util-is-identifier-name | 3.0.0 | MIT | syntax-tree/estree-util-is-identifier-name |
| estree-walker | 3.0.3 | MIT | https://github.com/Rich-Harris/estree-walker |
| etag | 1.8.1 | MIT | jshttp/etag |
| eventemitter3 | 4.0.7 | MIT | git://github.com/primus/eventemitter3.git |
| execa | 8.0.1 | MIT | sindresorhus/execa |
| express | 4.22.1 | MIT | expressjs/express |
| extend | 3.0.2 | MIT | https://github.com/justmoon/node-extend.git |
| fast-glob | 3.3.3 | MIT | mrmlnc/fast-glob |
| fastq | 1.20.1 | ISC | https://github.com/mcollina/fastq.git |
| fdir | 6.5.0 | MIT | https://github.com/thecodrr/fdir.git |
| fetch-blob | 3.2.0 | MIT | https://github.com/node-fetch/fetch-blob.git |
| fflate | 0.8.2 | MIT | https://github.com/101arrowz/fflate |
| fill-range | 7.1.1 | MIT | jonschlinkert/fill-range |
| finalhandler | 1.3.2 | MIT | pillarjs/finalhandler |
| formdata-polyfill | 4.0.10 | MIT | https://jimmywarting@github.com/jimmywarting/FormData.git |
| forwarded | 0.2.0 | MIT | jshttp/forwarded |
| fraction.js | 5.3.4 | MIT | ssh://git@github.com/rawify/Fraction.js.git |
| freebsd-arm64 | 0.18.20 | MIT |  |
| freebsd-arm64 | 0.21.5 | MIT |  |
| freebsd-x64 | 0.18.20 | MIT |  |
| freebsd-x64 | 0.21.5 | MIT |  |
| fresh | 0.5.2 | MIT | jshttp/fresh |
| fs.realpath | 1.0.0 | ISC | https://github.com/isaacs/fs.realpath.git |
| fsevents | 2.3.3 | MIT |  |
| function-bind | 1.1.2 | MIT | https://github.com/Raynos/function-bind.git |
| gensync | 1.0.0-beta.2 | MIT | https://github.com/loganfsmyth/gensync.git |
| get-caller-file | 2.0.5 | ISC | https://github.com/stefanpenner/get-caller-file.git |
| get-func-name | 2.0.2 | MIT | ssh://git@github.com/chaijs/get-func-name.git |
| get-intrinsic | 1.3.0 | MIT | https://github.com/ljharb/get-intrinsic.git |
| get-proto | 1.0.1 | MIT | https://github.com/ljharb/get-proto.git |
| get-stream | 8.0.1 | MIT | sindresorhus/get-stream |
| glob | 7.2.3 | ISC | git://github.com/isaacs/node-glob.git |
| glob-parent | 5.1.2 | ISC | gulpjs/glob-parent |
| glob-parent | 6.0.2 | ISC | gulpjs/glob-parent |
| gopd | 1.2.0 | MIT | https://github.com/ljharb/gopd.git |
| has-flag | 4.0.0 | MIT | sindresorhus/has-flag |
| has-symbols | 1.1.0 | MIT | git://github.com/inspect-js/has-symbols.git |
| hasown | 2.0.2 | MIT | https://github.com/inspect-js/hasOwn.git |
| hast-util-to-jsx-runtime | 2.3.6 | MIT | syntax-tree/hast-util-to-jsx-runtime |
| hast-util-whitespace | 3.0.0 | MIT | syntax-tree/hast-util-whitespace |
| html-encoding-sniffer | 6.0.0 | MIT | https://github.com/jsdom/html-encoding-sniffer.git |
| html-escaper | 2.0.2 | MIT | https://github.com/WebReflection/html-escaper.git |
| html-url-attributes | 3.0.1 | MIT | https://github.com/rehypejs/rehype-minify/tree/main/packages/html-url-attributes |
| http-errors | 2.0.1 | MIT | jshttp/http-errors |
| http-proxy-agent | 7.0.2 | MIT | https://github.com/TooTallNate/proxy-agents.git |
| https-proxy-agent | 7.0.6 | MIT | https://github.com/TooTallNate/proxy-agents.git |
| human-signals | 5.0.0 | Apache-2.0 | ehmicky/human-signals |
| iconv-lite | 0.4.24 | MIT | git://github.com/ashtuchkin/iconv-lite.git |
| indent-string | 4.0.0 | MIT | sindresorhus/indent-string |
| inflight | 1.0.6 | ISC | https://github.com/npm/inflight.git |
| inherits | 2.0.4 | ISC | git://github.com/isaacs/inherits |
| inline-style-parser | 0.2.7 | MIT | https://github.com/remarkablemark/inline-style-parser.git |
| ipaddr.js | 1.9.1 | MIT | git://github.com/whitequark/ipaddr.js |
| is-alphabetical | 2.0.1 | MIT | wooorm/is-alphabetical |
| is-alphanumerical | 2.0.1 | MIT | wooorm/is-alphanumerical |
| is-binary-path | 2.1.0 | MIT | sindresorhus/is-binary-path |
| is-core-module | 2.16.1 | MIT | https://github.com/inspect-js/is-core-module.git |
| is-decimal | 2.0.1 | MIT | wooorm/is-decimal |
| is-extglob | 2.1.1 | MIT | jonschlinkert/is-extglob |
| is-fullwidth-code-point | 3.0.0 | MIT | sindresorhus/is-fullwidth-code-point |
| is-glob | 4.0.3 | MIT | micromatch/is-glob |
| is-hexadecimal | 2.0.1 | MIT | wooorm/is-hexadecimal |
| is-number | 7.0.0 | MIT | jonschlinkert/is-number |
| is-plain-obj | 4.1.0 | MIT | sindresorhus/is-plain-obj |
| is-potential-custom-element-name | 1.0.1 | MIT | https://github.com/mathiasbynens/is-potential-custom-element-name.git |
| is-stream | 3.0.0 | MIT | sindresorhus/is-stream |
| isexe | 2.0.0 | ISC | https://github.com/isaacs/isexe.git |
| istanbul-lib-coverage | 3.2.2 | BSD-3-Clause | ssh://git@github.com/istanbuljs/istanbuljs.git |
| istanbul-lib-report | 3.0.1 | BSD-3-Clause | ssh://git@github.com/istanbuljs/istanbuljs.git |
| istanbul-lib-source-maps | 5.0.6 | BSD-3-Clause | ssh://git@github.com/istanbuljs/istanbuljs.git |
| istanbul-reports | 3.2.0 | BSD-3-Clause | ssh://git@github.com/istanbuljs/istanbuljs.git |
| jiti | 1.21.7 | MIT | unjs/jiti |
| js-tokens | 4.0.0 | MIT | lydell/js-tokens |
| js-tokens | 9.0.1 | MIT | lydell/js-tokens |
| jsdom | 28.1.0 | MIT | https://github.com/jsdom/jsdom.git |
| jsesc | 3.1.0 | MIT | https://github.com/mathiasbynens/jsesc.git |
| json5 | 2.2.3 | MIT | https://github.com/json5/json5.git |
| lilconfig | 3.1.3 | MIT | https://github.com/antonk52/lilconfig |
| lines-and-columns | 1.2.4 | MIT | https://github.com/eventualbuddha/lines-and-columns.git |
| linux-arm | 0.18.20 | MIT |  |
| linux-arm | 0.21.5 | MIT |  |
| linux-arm64 | 0.18.20 | MIT |  |
| linux-arm64 | 0.21.5 | MIT |  |
| linux-ia32 | 0.18.20 | MIT |  |
| linux-ia32 | 0.21.5 | MIT |  |
| linux-loong64 | 0.18.20 | MIT |  |
| linux-loong64 | 0.21.5 | MIT |  |
| linux-mips64el | 0.18.20 | MIT |  |
| linux-mips64el | 0.21.5 | MIT |  |
| linux-ppc64 | 0.18.20 | MIT |  |
| linux-ppc64 | 0.21.5 | MIT |  |
| linux-riscv64 | 0.18.20 | MIT |  |
| linux-riscv64 | 0.21.5 | MIT |  |
| linux-s390x | 0.18.20 | MIT |  |
| linux-s390x | 0.21.5 | MIT |  |
| linux-x64 | 0.18.20 | MIT |  |
| linux-x64 | 0.21.5 | MIT |  |
| local-pkg | 0.5.1 | MIT | https://github.com/antfu/local-pkg.git |
| longest-streak | 3.1.0 | MIT | wooorm/longest-streak |
| loose-envify | 1.4.0 | MIT | git://github.com/zertosh/loose-envify.git |
| loupe | 2.3.7 | MIT | https://github.com/chaijs/loupe |
| lru-cache | 11.2.6 | BlueOak-1.0.0 | ssh://git@github.com/isaacs/node-lru-cache.git |
| lru-cache | 5.1.1 | ISC | git://github.com/isaacs/node-lru-cache.git |
| lucide-react | 0.400.0 | ISC | https://github.com/lucide-icons/lucide.git |
| lz-string | 1.5.0 | MIT | https://github.com/pieroxy/lz-string.git |
| magic-string | 0.30.21 | MIT | https://github.com/Rich-Harris/magic-string.git |
| magicast | 0.3.5 | MIT | unjs/magicast |
| make-dir | 4.0.0 | MIT | sindresorhus/make-dir |
| markdown-table | 3.0.4 | MIT | wooorm/markdown-table |
| math-intrinsics | 1.1.0 | MIT | https://github.com/es-shims/math-intrinsics.git |
| mdast-util-find-and-replace | 3.0.2 | MIT | syntax-tree/mdast-util-find-and-replace |
| mdast-util-from-markdown | 2.0.2 | MIT | syntax-tree/mdast-util-from-markdown |
| mdast-util-gfm | 3.1.0 | MIT | syntax-tree/mdast-util-gfm |
| mdast-util-gfm-autolink-literal | 2.0.1 | MIT | syntax-tree/mdast-util-gfm-autolink-literal |
| mdast-util-gfm-footnote | 2.1.0 | MIT | syntax-tree/mdast-util-gfm-footnote |
| mdast-util-gfm-strikethrough | 2.0.0 | MIT | syntax-tree/mdast-util-gfm-strikethrough |
| mdast-util-gfm-table | 2.0.0 | MIT | syntax-tree/mdast-util-gfm-table |
| mdast-util-gfm-task-list-item | 2.0.0 | MIT | syntax-tree/mdast-util-gfm-task-list-item |
| mdast-util-mdx-expression | 2.0.1 | MIT | syntax-tree/mdast-util-mdx-expression |
| mdast-util-mdx-jsx | 3.2.0 | MIT | syntax-tree/mdast-util-mdx-jsx |
| mdast-util-mdxjs-esm | 2.0.1 | MIT | syntax-tree/mdast-util-mdxjs-esm |
| mdast-util-newline-to-break | 2.0.0 | MIT | syntax-tree/mdast-util-newline-to-break |
| mdast-util-phrasing | 4.1.0 | MIT | syntax-tree/mdast-util-phrasing |
| mdast-util-to-hast | 13.2.1 | MIT | syntax-tree/mdast-util-to-hast |
| mdast-util-to-markdown | 2.1.2 | MIT | syntax-tree/mdast-util-to-markdown |
| mdast-util-to-string | 4.0.0 | MIT | syntax-tree/mdast-util-to-string |
| mdn-data | 2.12.2 | CC0-1.0 | https://github.com/mdn/data.git |
| media-typer | 0.3.0 | MIT | jshttp/media-typer |
| merge-descriptors | 1.0.3 | MIT | sindresorhus/merge-descriptors |
| merge-stream | 2.0.0 | MIT | grncdr/merge-stream |
| merge2 | 1.4.1 | MIT | git@github.com:teambition/merge2.git |
| meshoptimizer | 1.0.1 | MIT | https://github.com/zeux/meshoptimizer |
| methods | 1.1.2 | MIT | jshttp/methods |
| micromark | 4.0.2 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark |
| micromark-core-commonmark | 2.0.3 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-core-commonmark |
| micromark-extension-gfm | 3.0.0 | MIT | micromark/micromark-extension-gfm |
| micromark-extension-gfm-autolink-literal | 2.1.0 | MIT | micromark/micromark-extension-gfm-autolink-literal |
| micromark-extension-gfm-footnote | 2.1.0 | MIT | micromark/micromark-extension-gfm-footnote |
| micromark-extension-gfm-strikethrough | 2.1.0 | MIT | micromark/micromark-extension-gfm-strikethrough |
| micromark-extension-gfm-table | 2.1.1 | MIT | micromark/micromark-extension-gfm-table |
| micromark-extension-gfm-tagfilter | 2.0.0 | MIT | micromark/micromark-extension-gfm-tagfilter |
| micromark-extension-gfm-task-list-item | 2.1.0 | MIT | micromark/micromark-extension-gfm-task-list-item |
| micromark-factory-destination | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-destination |
| micromark-factory-label | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-label |
| micromark-factory-space | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-space |
| micromark-factory-title | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-title |
| micromark-factory-whitespace | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-whitespace |
| micromark-util-character | 2.1.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-character |
| micromark-util-chunked | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-chunked |
| micromark-util-classify-character | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-classify-character |
| micromark-util-combine-extensions | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-combine-extensions |
| micromark-util-decode-numeric-character-reference | 2.0.2 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-decode-numeric-character-reference |
| micromark-util-decode-string | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-decode-string |
| micromark-util-encode | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-encode |
| micromark-util-html-tag-name | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-html-tag-name |
| micromark-util-normalize-identifier | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-normalize-identifier |
| micromark-util-resolve-all | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-resolve-all |
| micromark-util-sanitize-uri | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-sanitize-uri |
| micromark-util-subtokenize | 2.1.0 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-subtokenize |
| micromark-util-symbol | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-symbol |
| micromark-util-types | 2.0.2 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-types |
| micromatch | 4.0.8 | MIT | micromatch/micromatch |
| mime | 1.6.0 | MIT | https://github.com/broofa/node-mime |
| mime-db | 1.52.0 | MIT | jshttp/mime-db |
| mime-types | 2.1.35 | MIT | jshttp/mime-types |
| mimic-fn | 4.0.0 | MIT | sindresorhus/mimic-fn |
| min-indent | 1.0.1 | MIT | https://github.com/thejameskyle/min-indent |
| minimatch | 3.1.3 | ISC | git://github.com/isaacs/minimatch.git |
| mlly | 1.8.0 | MIT | unjs/mlly |
| ms | 2.0.0 | MIT | zeit/ms |
| ms | 2.1.3 | MIT | vercel/ms |
| mz | 2.7.0 | MIT | normalize/mz |
| nanoid | 3.3.11 | MIT | ai/nanoid |
| negotiator | 0.6.3 | MIT | jshttp/negotiator |
| netbsd-x64 | 0.18.20 | MIT |  |
| netbsd-x64 | 0.21.5 | MIT |  |
| node-domexception | 1.0.0 | MIT | https://github.com/jimmywarting/node-domexception.git |
| node-fetch | 3.3.2 | MIT | https://github.com/node-fetch/node-fetch.git |
| node-releases | 2.0.27 | MIT | https://github.com/chicoxyzzy/node-releases.git |
| normalize-path | 3.0.0 | MIT | jonschlinkert/normalize-path |
| npm-run-path | 5.3.0 | MIT | sindresorhus/npm-run-path |
| object-assign | 4.1.1 | MIT | sindresorhus/object-assign |
| object-hash | 3.0.0 | MIT | https://github.com/puleos/object-hash |
| object-inspect | 1.13.4 | MIT | git://github.com/inspect-js/object-inspect.git |
| on-finished | 2.4.1 | MIT | jshttp/on-finished |
| once | 1.4.0 | ISC | git://github.com/isaacs/once |
| onetime | 6.0.0 | MIT | sindresorhus/onetime |
| openbsd-x64 | 0.18.20 | MIT |  |
| openbsd-x64 | 0.21.5 | MIT |  |
| p-limit | 5.0.0 | MIT | sindresorhus/p-limit |
| parse-entities | 4.0.2 | MIT | wooorm/parse-entities |
| parse5 | 8.0.0 | MIT | git://github.com/inikulin/parse5.git |
| parseurl | 1.3.3 | MIT | pillarjs/parseurl |
| path-is-absolute | 1.0.1 | MIT | sindresorhus/path-is-absolute |
| path-key | 3.1.1 | MIT | sindresorhus/path-key |
| path-key | 4.0.0 | MIT | sindresorhus/path-key |
| path-parse | 1.0.7 | MIT | https://github.com/jbgutierrez/path-parse.git |
| path-to-regexp | 0.1.12 | MIT | https://github.com/pillarjs/path-to-regexp.git |
| pathe | 1.1.2 | MIT | unjs/pathe |
| pathe | 2.0.3 | MIT | unjs/pathe |
| pathval | 1.1.1 | MIT | ssh://git@github.com/chaijs/pathval.git |
| peer | 1.0.2 | MIT | https://github.com/peers/peerjs-server |
| peerjs | 1.5.5 | MIT | https://github.com/peers/peerjs |
| peerjs-js-binarypack | 2.1.0 | MIT | https://github.com/peers/js-binarypack |
| photon-realtime | 4.4.0 | SEE LICENSE IN https://www.photonengine.com/terms |  |
| picocolors | 1.1.1 | ISC | alexeyraspopov/picocolors |
| picomatch | 2.3.1 | MIT | micromatch/picomatch |
| picomatch | 4.0.3 | MIT | micromatch/picomatch |
| pify | 2.3.0 | MIT | sindresorhus/pify |
| pirates | 4.0.7 | MIT | https://github.com/danez/pirates.git |
| pkg-types | 1.3.1 | MIT | unjs/pkg-types |
| postcss | 8.5.6 | MIT | postcss/postcss |
| postcss-import | 15.1.0 | MIT | https://github.com/postcss/postcss-import.git |
| postcss-js | 4.1.0 | MIT | postcss/postcss-js |
| postcss-load-config | 6.0.1 | MIT | postcss/postcss-load-config |
| postcss-nested | 6.2.0 | MIT | postcss/postcss-nested |
| postcss-selector-parser | 6.1.2 | MIT | postcss/postcss-selector-parser |
| postcss-value-parser | 4.2.0 | MIT | https://github.com/TrySound/postcss-value-parser.git |
| prettier | 3.8.1 | MIT | prettier/prettier |
| pretty-format | 27.5.1 | MIT | https://github.com/facebook/jest.git |
| pretty-format | 29.7.0 | MIT | https://github.com/jestjs/jest.git |
| property-information | 7.1.0 | MIT | wooorm/property-information |
| proxy-addr | 2.0.7 | MIT | jshttp/proxy-addr |
| punycode | 2.3.1 | MIT | https://github.com/mathiasbynens/punycode.js.git |
| qs | 6.14.2 | BSD-3-Clause | https://github.com/ljharb/qs.git |
| queue-microtask | 1.2.3 | MIT | git://github.com/feross/queue-microtask.git |
| range-parser | 1.2.1 | MIT | jshttp/range-parser |
| raw-body | 2.5.3 | MIT | stream-utils/raw-body |
| react | 18.3.1 | MIT | https://github.com/facebook/react.git |
| react-dom | 18.3.1 | MIT | https://github.com/facebook/react.git |
| react-is | 17.0.2 | MIT | https://github.com/facebook/react.git |
| react-is | 18.3.1 | MIT | https://github.com/facebook/react.git |
| react-markdown | 10.1.0 | MIT | remarkjs/react-markdown |
| react-refresh | 0.17.0 | MIT | https://github.com/facebook/react.git |
| read-cache | 1.0.0 | MIT | https://github.com/TrySound/read-cache.git |
| readdirp | 3.6.0 | MIT | git://github.com/paulmillr/readdirp.git |
| redent | 3.0.0 | MIT | sindresorhus/redent |
| remark-breaks | 4.0.0 | MIT | remarkjs/remark-breaks |
| remark-gfm | 4.0.1 | MIT | remarkjs/remark-gfm |
| remark-parse | 11.0.0 | MIT | https://github.com/remarkjs/remark/tree/main/packages/remark-parse |
| remark-rehype | 11.1.2 | MIT | remarkjs/remark-rehype |
| remark-stringify | 11.0.0 | MIT | https://github.com/remarkjs/remark/tree/main/packages/remark-stringify |
| require-directory | 2.1.1 | MIT | git://github.com/troygoode/node-require-directory.git |
| require-from-string | 2.0.2 | MIT | floatdrop/require-from-string |
| resolve | 1.22.11 | MIT | ssh://github.com/browserify/resolve.git |
| reusify | 1.1.0 | MIT | https://github.com/mcollina/reusify.git |
| rollup | 3.29.5 | MIT | rollup/rollup |
| rollup | 4.57.1 | MIT | https://github.com/rollup/rollup.git |
| rollup-android-arm-eabi | 4.57.1 | MIT |  |
| rollup-android-arm64 | 4.57.1 | MIT |  |
| rollup-darwin-arm64 | 4.57.1 | MIT |  |
| rollup-darwin-x64 | 4.57.1 | MIT |  |
| rollup-freebsd-arm64 | 4.57.1 | MIT |  |
| rollup-freebsd-x64 | 4.57.1 | MIT |  |
| rollup-linux-arm-gnueabihf | 4.57.1 | MIT |  |
| rollup-linux-arm-musleabihf | 4.57.1 | MIT |  |
| rollup-linux-arm64-gnu | 4.57.1 | MIT |  |
| rollup-linux-arm64-musl | 4.57.1 | MIT |  |
| rollup-linux-loong64-gnu | 4.57.1 | MIT |  |
| rollup-linux-loong64-musl | 4.57.1 | MIT |  |
| rollup-linux-ppc64-gnu | 4.57.1 | MIT |  |
| rollup-linux-ppc64-musl | 4.57.1 | MIT |  |
| rollup-linux-riscv64-gnu | 4.57.1 | MIT |  |
| rollup-linux-riscv64-musl | 4.57.1 | MIT |  |
| rollup-linux-s390x-gnu | 4.57.1 | MIT |  |
| rollup-linux-x64-gnu | 4.57.1 | MIT |  |
| rollup-linux-x64-musl | 4.57.1 | MIT |  |
| rollup-openbsd-x64 | 4.57.1 | MIT |  |
| rollup-openharmony-arm64 | 4.57.1 | MIT |  |
| rollup-win32-arm64-msvc | 4.57.1 | MIT |  |
| rollup-win32-ia32-msvc | 4.57.1 | MIT |  |
| run-parallel | 1.2.0 | MIT | git://github.com/feross/run-parallel.git |
| safe-buffer | 5.2.1 | MIT | git://github.com/feross/safe-buffer.git |
| safer-buffer | 2.1.2 | MIT | https://github.com/ChALkeR/safer-buffer.git |
| saxes | 6.0.0 | ISC | https://github.com/lddubeau/saxes.git |
| scheduler | 0.23.2 | MIT | https://github.com/facebook/react.git |
| sdp | 3.2.1 | MIT | https://github.com/fippo/sdp.git |
| semver | 6.3.1 | ISC | https://github.com/npm/node-semver.git |
| semver | 7.7.4 | ISC | https://github.com/npm/node-semver.git |
| send | 0.19.2 | MIT | pillarjs/send |
| serve-static | 1.16.3 | MIT | expressjs/serve-static |
| setprototypeof | 1.2.0 | ISC | https://github.com/wesleytodd/setprototypeof.git |
| shebang-command | 2.0.0 | MIT | kevva/shebang-command |
| shebang-regex | 3.0.0 | MIT | sindresorhus/shebang-regex |
| side-channel | 1.1.0 | MIT | https://github.com/ljharb/side-channel.git |
| side-channel-list | 1.0.0 | MIT | https://github.com/ljharb/side-channel-list.git |
| side-channel-map | 1.0.1 | MIT | https://github.com/ljharb/side-channel-map.git |
| side-channel-weakmap | 1.0.2 | MIT | https://github.com/ljharb/side-channel-weakmap.git |
| siginfo | 2.0.0 | ISC | https://github.com/emilbayes/siginfo.git |
| signal-exit | 4.1.0 | ISC | https://github.com/tapjs/signal-exit.git |
| source-map-js | 1.2.1 | BSD-3-Clause | 7rulnik/source-map-js |
| space-separated-tokens | 2.0.2 | MIT | wooorm/space-separated-tokens |
| stackback | 0.0.2 | MIT | git://github.com/shtylman/node-stackback.git |
| statuses | 2.0.2 | MIT | jshttp/statuses |
| std-env | 3.10.0 | MIT | unjs/std-env |
| string-width | 4.2.3 | MIT | sindresorhus/string-width |
| stringify-entities | 4.0.4 | MIT | wooorm/stringify-entities |
| strip-ansi | 6.0.1 | MIT | chalk/strip-ansi |
| strip-final-newline | 3.0.0 | MIT | sindresorhus/strip-final-newline |
| strip-indent | 3.0.0 | MIT | sindresorhus/strip-indent |
| strip-literal | 2.1.1 | MIT | https://github.com/antfu/strip-literal.git |
| style-to-js | 1.1.21 | MIT | https://github.com/remarkablemark/style-to-js.git |
| style-to-object | 1.0.14 | MIT | https://github.com/remarkablemark/style-to-object.git |
| sucrase | 3.35.1 | MIT | https://github.com/alangpierce/sucrase.git |
| sunos-x64 | 0.18.20 | MIT |  |
| sunos-x64 | 0.21.5 | MIT |  |
| supports-color | 7.2.0 | MIT | chalk/supports-color |
| supports-preserve-symlinks-flag | 1.0.0 | MIT | https://github.com/inspect-js/node-supports-preserve-symlinks-flag.git |
| symbol-tree | 3.2.4 | MIT | https://github.com/jsdom/js-symbol-tree.git |
| tailwindcss | 3.4.19 | MIT | https://github.com/tailwindlabs/tailwindcss.git#v3 |
| test-exclude | 6.0.0 | ISC | https://github.com/istanbuljs/test-exclude.git |
| thenify | 3.3.1 | MIT | thenables/thenify |
| thenify-all | 1.6.0 | MIT | thenables/thenify-all |
| three | 0.183.0 | MIT | https://github.com/mrdoob/three.js |
| tinybench | 2.9.0 | MIT | tinylibs/tinybench |
| tinyglobby | 0.2.15 | MIT | https://github.com/SuperchupuDev/tinyglobby.git |
| tinypool | 0.8.4 | MIT | https://github.com/tinylibs/tinypool.git |
| tinyspy | 2.2.1 | MIT | https://github.com/tinylibs/tinyspy.git |
| tldts | 7.0.23 | MIT | ssh://git@github.com/remusao/tldts.git |
| tldts-core | 7.0.23 | MIT | ssh://git@github.com/remusao/tldts.git |
| to-regex-range | 5.0.1 | MIT | micromatch/to-regex-range |
| toidentifier | 1.0.1 | MIT | component/toidentifier |
| tough-cookie | 6.0.0 | BSD-3-Clause | git://github.com/salesforce/tough-cookie.git |
| tr46 | 6.0.0 | MIT | https://github.com/jsdom/tr46.git |
| trim-lines | 3.0.1 | MIT | wooorm/trim-lines |
| trough | 2.2.0 | MIT | wooorm/trough |
| ts-interface-checker | 0.1.13 | Apache-2.0 | https://github.com/gristlabs/ts-interface-checker |
| type-detect | 4.1.0 | MIT | ssh://git@github.com/chaijs/type-detect.git |
| type-is | 1.6.18 | MIT | jshttp/type-is |
| typescript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript.git |
| ufo | 1.6.3 | MIT | unjs/ufo |
| undici | 7.22.0 | MIT | https://github.com/nodejs/undici.git |
| undici-types | 7.16.0 | MIT | https://github.com/nodejs/undici.git |
| unified | 11.0.5 | MIT | unifiedjs/unified |
| unist-util-is | 6.0.1 | MIT | syntax-tree/unist-util-is |
| unist-util-position | 5.0.0 | MIT | syntax-tree/unist-util-position |
| unist-util-stringify-position | 4.0.0 | MIT | syntax-tree/unist-util-stringify-position |
| unist-util-visit | 5.1.0 | MIT | syntax-tree/unist-util-visit |
| unist-util-visit-parents | 6.0.2 | MIT | syntax-tree/unist-util-visit-parents |
| unpipe | 1.0.0 | MIT | stream-utils/unpipe |
| update-browserslist-db | 1.2.3 | MIT | browserslist/update-db |
| util-deprecate | 1.0.2 | MIT | git://github.com/TooTallNate/util-deprecate.git |
| utils-merge | 1.0.1 | MIT | git://github.com/jaredhanson/utils-merge.git |
| vary | 1.1.2 | MIT | jshttp/vary |
| vfile | 6.0.3 | MIT | vfile/vfile |
| vfile-message | 4.0.3 | MIT | vfile/vfile-message |
| vite | 4.5.14 | MIT | https://github.com/vitejs/vite.git |
| vite | 5.4.21 | MIT | https://github.com/vitejs/vite.git |
| vite-node | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| vitest | 1.6.1 | MIT | https://github.com/vitest-dev/vitest.git |
| w3c-xmlserializer | 5.0.0 | MIT | jsdom/w3c-xmlserializer |
| web-streams-polyfill | 3.3.3 | MIT | https://github.com/MattiasBuelens/web-streams-polyfill.git |
| webidl-conversions | 8.0.1 | BSD-2-Clause | https://github.com/jsdom/webidl-conversions.git |
| webrtc-adapter | 9.0.3 | BSD-3-Clause | https://github.com/webrtchacks/adapter.git |
| whatwg-mimetype | 5.0.0 | MIT | jsdom/whatwg-mimetype |
| whatwg-url | 16.0.1 | MIT | https://github.com/jsdom/whatwg-url.git |
| which | 2.0.2 | ISC | git://github.com/isaacs/node-which.git |
| why-is-node-running | 2.3.0 | MIT | https://github.com/mafintosh/why-is-node-running.git |
| win32-arm64 | 0.18.20 | MIT |  |
| win32-arm64 | 0.21.5 | MIT |  |
| win32-ia32 | 0.18.20 | MIT |  |
| win32-ia32 | 0.21.5 | MIT |  |
| wrap-ansi | 7.0.0 | MIT | chalk/wrap-ansi |
| wrappy | 1.0.2 | ISC | https://github.com/npm/wrappy |
| ws | 8.19.0 | MIT | https://github.com/websockets/ws.git |
| xml-name-validator | 5.0.0 | Apache-2.0 | jsdom/xml-name-validator |
| xmlchars | 2.2.0 | MIT | https://github.com/lddubeau/xmlchars.git |
| y18n | 5.0.8 | ISC | yargs/y18n |
| yallist | 3.1.1 | ISC | https://github.com/isaacs/yallist.git |
| yargs | 17.7.2 | MIT | https://github.com/yargs/yargs.git |
| yargs-parser | 21.1.1 | ISC | https://github.com/yargs/yargs-parser.git |
| yocto-queue | 1.2.2 | MIT | sindresorhus/yocto-queue |
| zwitch | 2.0.4 | MIT | wooorm/zwitch |
