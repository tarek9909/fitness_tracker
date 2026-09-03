import { emailService } from '../shared/services/email.service.js';

try {
  await emailService.verifyTransport();
  console.log('SMTP transport verified successfully.');
} catch (error) {
  console.error('SMTP transport verification failed.');
  process.exitCode = 1;
}
