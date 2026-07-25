const p = require('child_process').spawn('npx.cmd', ['drizzle-kit', 'generate'], { shell: true });
p.stdout.on('data', data => {
  const output = data.toString();
  process.stdout.write(output);
  if (output.includes('rename') || output.includes('❯')) {
    p.stdin.write('\r');
  }
});
p.stderr.on('data', data => process.stderr.write(data));
p.on('close', code => console.log('done with code:', code));
