import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  analyzeInput(input: string) {
    const timestamp = new Date().toISOString();
    
    // 1. Defensive Sanitization (The Guard)
    const sanitized = input.replace(/[<>{}[\]]/g, '');
    const wasSanitized = sanitized !== input;

    // 2. Heuristic Logic (The Brain)
    let sentiment = 'SECURE';
    let note = 'Integrity check passed. No anomalies detected.';

    if (wasSanitized) {
      sentiment = 'SANITIZED';
      note = 'Hostile characters detected and removed for safety.';
    } else if (input.length > 50) {
      sentiment = 'SUSPECT';
      note = 'Payload length exceeds standard baseline. Monitoring...';
    } else if (input.toLowerCase().includes('admin') || input.toLowerCase().includes('root')) {
      sentiment = 'HOSTILE';
      note = 'Privilege escalation keyword detected.';
    }

    return {
      id: Date.now(),
      timestamp,
      original: input,
      sanitized,
      sentiment,
      note,
      node: 'rosencrantz-processing-alpha'
    };
  }
}
