// Email Service using Resend integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

// Email types for co-op notifications
export type EmailType = 'new_assignment' | 'due_soon' | 'missing_submission';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const result = await client.emails.send({
      from: fromEmail || 'Lesson Logger <notifications@lessonlogger.com>',
      to: params.to,
      subject: params.subject,
      html: params.html
    });
    
    console.log('Email sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Email templates for co-op notifications
export function getNewAssignmentEmail(params: {
  parentName: string;
  studentName: string;
  assignmentTitle: string;
  className: string;
  dueDate?: string;
  instructions?: string;
}): { subject: string; html: string } {
  const dueDateText = params.dueDate 
    ? `<p><strong>Due Date:</strong> ${new Date(params.dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>`
    : '';
  
  const instructionsText = params.instructions
    ? `<p><strong>Instructions:</strong> ${params.instructions}</p>`
    : '';

  return {
    subject: `New Assignment: ${params.assignmentTitle} - ${params.className}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
          .footer { text-align: center; padding: 15px; color: #718096; font-size: 12px; }
          .button { display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Assignment Posted</h1>
          </div>
          <div class="content">
            <p>Hello ${params.parentName},</p>
            <p>A new assignment has been posted for <strong>${params.studentName}</strong> in <strong>${params.className}</strong>.</p>
            <h2>${params.assignmentTitle}</h2>
            ${dueDateText}
            ${instructionsText}
            <p>Log in to the student portal to view the full assignment and submit work.</p>
          </div>
          <div class="footer">
            <p>Lesson Logger</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

export function getDueSoonEmail(params: {
  parentName: string;
  studentName: string;
  assignments: Array<{ title: string; className: string; dueDate: string }>;
}): { subject: string; html: string } {
  const assignmentList = params.assignments.map(a => `
    <li>
      <strong>${a.title}</strong> - ${a.className}<br>
      Due: ${new Date(a.dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
    </li>
  `).join('');

  return {
    subject: `Reminder: ${params.assignments.length} assignment${params.assignments.length > 1 ? 's' : ''} due soon`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #d69e2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
          .footer { text-align: center; padding: 15px; color: #718096; font-size: 12px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Assignments Due Soon</h1>
          </div>
          <div class="content">
            <p>Hello ${params.parentName},</p>
            <p>This is a reminder that <strong>${params.studentName}</strong> has the following assignments due soon:</p>
            <ul>
              ${assignmentList}
            </ul>
            <p>Log in to the student portal to submit work before the due dates.</p>
          </div>
          <div class="footer">
            <p>Lesson Logger</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

export function getMissingSubmissionEmail(params: {
  parentName: string;
  studentName: string;
  assignments: Array<{ title: string; className: string; dueDate: string }>;
}): { subject: string; html: string } {
  const assignmentList = params.assignments.map(a => `
    <li>
      <strong>${a.title}</strong> - ${a.className}<br>
      Was due: ${new Date(a.dueDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
    </li>
  `).join('');

  return {
    subject: `Missing Submission: ${params.assignments.length} assignment${params.assignments.length > 1 ? 's' : ''} past due`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #c53030; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
          .footer { text-align: center; padding: 15px; color: #718096; font-size: 12px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Missing Submissions</h1>
          </div>
          <div class="content">
            <p>Hello ${params.parentName},</p>
            <p><strong>${params.studentName}</strong> has not yet submitted work for the following assignments:</p>
            <ul>
              ${assignmentList}
            </ul>
            <p>Please log in to the student portal to submit the missing work as soon as possible.</p>
          </div>
          <div class="footer">
            <p>Lesson Logger</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}
