import {execFileSync} from 'node:child_process'
import {rmSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, resolve} from 'node:path'

const npmCli = process.env.npm_execpath

if (!npmCli) {
  throw new Error('This package check must be run from an npm script')
}

const output = execFileSync(
  process.execPath,
  [npmCli, 'pack', '--ignore-scripts', '--dry-run=false', '--json'],
  {encoding: 'utf8'}
)
const result = JSON.parse(output)
const filename = result[0]?.filename

if (typeof filename !== 'string') {
  throw new Error('npm pack did not return a tarball filename')
}

const tarball = resolve(filename)

if (dirname(tarball) !== process.cwd()) {
  throw new Error(`Refusing to inspect a tarball outside the package: ${tarball}`)
}

const require = createRequire(import.meta.url)
const attwPackage = require.resolve('@arethetypeswrong/cli/package.json')
const attwCli = resolve(dirname(attwPackage), 'dist/index.js')

try {
  execFileSync(process.execPath, [attwCli, tarball, '--profile', 'esm-only'], {
    stdio: 'inherit'
  })
} finally {
  rmSync(tarball, {force: true})
}
