import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import path from 'path';

@Injectable()
export class BrainService {
  async analyze(text: string): Promise<any> {
    return new Promise((resolve) => {
      const brainPath = path.join(__dirname, '..', 'brain.py');
      const python = spawn('python3', [brainPath]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => { stdout += data.toString(); });
      python.stderr.on('data', (data) => { stderr += data.toString(); });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error(`[brain.py] Exited with code ${code}. Stderr: ${stderr}`);
          return resolve({ label: 'ERROR', score: 0.0, entropy: 0 });
        }
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (e) {
          console.error(`[brain.py] JSON parse failed. Raw stdout: "${stdout}" | Stderr: "${stderr}"`);
          resolve({ label: 'ERROR', score: 0.0, entropy: 0 });
        }
      });

      python.on('error', (err) => {
        console.error(`[brain.py] Failed to spawn process: ${err.message}`);
        resolve({ label: 'ERROR', score: 0.0, entropy: 0 });
      });

      python.stdin.write(text + '\n');
      python.stdin.end();
    });
  }
}
