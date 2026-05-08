// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

const config = {
  input: 'src/utils.ts',
  output: {
    esModule: true,
    file: 'dist/utils.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    typescript({ declaration: false, declarationMap: false, composite: false }),
    nodeResolve({ preferBuiltins: true }),
    commonjs()
  ]
}

export default config
