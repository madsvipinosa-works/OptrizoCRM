/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');

const child = spawn('npx', ['drizzle-kit', 'generate'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  if (output.includes('?')) {
    child.stdin.write('\r\n'); // send enter automatically
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
  process.exit(code);
});
