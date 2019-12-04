import { DebugSession } from 'vscode-debugadapter'
import { KendryteDebugger } from '@debug/backend/kendryteDebugger'

require('source-map-support/register')

console.error('\n[kendryte debug] debugger loader.')
console.error('\n * ' + process.argv.join('\n * '))
process.title = 'gdb-session'

DebugSession.run(KendryteDebugger)