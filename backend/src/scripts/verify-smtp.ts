import { emailService } from '../shared/services/email.service.js';

try {
  await emailService.verifyTransport();
  console.log('SMTP transport verified successfully.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SMTP transport verification failed: ${message}`);
  process.exitCode = 1;
}
