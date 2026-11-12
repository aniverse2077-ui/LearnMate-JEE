import { getAccessToken, googleSignIn } from '../firebase';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

async function ensureToken(): Promise<string> {
  let token = await getAccessToken();
  if (!token) {
    const res = await googleSignIn(true);
    if (res.cancelled) {
      throw new Error('Google Workspace authorization window was closed before completing.');
    }
    token = res.accessToken;
  }
  if (!token) {
    throw new Error('Google Workspace permission is required. Please sign in with Google.');
  }
  return token;
}

/**
 * Lists recent PDFs and Google Docs from the user's Google Drive.
 */
export async function listDriveStudyFiles(): Promise<DriveFileItem[]> {
  const token = await ensureToken();
  const q = encodeURIComponent(
    "(mimeType='application/pdf' or mimeType='application/vnd.google-apps.document') and trashed=false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?pageSize=12&fields=files(id,name,mimeType,modifiedTime)&q=${q}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Drive API error (${res.status})`);
  }
  const data = await res.json();
  return data.files || [];
}

/**
 * Reads plain text paragraphs from a Google Doc by documentId.
 */
export async function readGoogleDocContent(documentId: string): Promise<{ title: string; text: string }> {
  const token = await ensureToken();
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Google Docs API error (${res.status})`);
  }
  const docData = await res.json();
  let extracted = '';
  for (const elem of docData.body?.content || []) {
    for (const pe of elem.paragraph?.elements || []) {
      if (pe.textRun?.content) {
        extracted += pe.textRun.content;
      }
    }
  }
  return {
    title: docData.title || 'Imported Google Doc Notes',
    text: extracted.trim() || 'Imported JEE study notes from Google Docs.',
  };
}

/**
 * Syncs a study task to the student's primary Google Tasks list & Google Calendar.
 */
export async function syncTaskToGoogleWorkspace(taskTitle: string, subject: string): Promise<{
  taskUrl?: string;
  calendarEventId?: string;
}> {
  const token = await ensureToken();

  // 1. Add to Google Tasks (@default list)
  await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[LearnMate JEE • ${subject}] ${taskTitle}`,
      notes: `Scheduled from LearnMate JEE Study Workspace`,
    }),
  });

  // 2. Create a 45-minute study block on Google Calendar
  const start = new Date();
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  const calRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `JEE Study: ${taskTitle} (${subject})`,
        description: 'Synced from LearnMate JEE',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    }
  );
  const calData = calRes.ok ? await calRes.json() : {};
  return {
    calendarEventId: calData.id,
  };
}

/**
 * Exports a revision mind map / chapter summary to a new Google Slides presentation.
 */
export async function exportRevisionToGoogleSlides(
  chapterTitle: string,
  cards: { title: string; body: string; trap: string }[]
): Promise<{ presentationId: string; url: string }> {
  const token = await ensureToken();
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `LearnMate JEE Revision — ${chapterTitle}`,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Google Slides API error (${createRes.status})`);
  }

  const presentation = await createRes.json();
  const presentationId = presentation.presentationId;

  // Populate summary text box on first slide if available
  const firstSlideId = presentation.slides?.[0]?.objectId;
  if (firstSlideId && cards.length > 0) {
    const boxId = `learnmate_box_${Date.now()}`;
    const summaryText = cards
      .slice(0, 4)
      .map((c, idx) => `${idx + 1}. ${c.title}: ${c.body} (Trap: ${c.trap})`)
      .join('\n');

    await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            createShape: {
              objectId: boxId,
              shapeType: 'TEXT_BOX',
              elementProperties: {
                pageObjectId: firstSlideId,
                size: {
                  height: { magnitude: 220, unit: 'PT' },
                  width: { magnitude: 580, unit: 'PT' },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: 50,
                  translateY: 120,
                  unit: 'PT',
                },
              },
            },
          },
          {
            insertText: {
              objectId: boxId,
              insertionIndex: 0,
              text: summaryText,
            },
          },
        ],
      }),
    });
  }

  return {
    presentationId,
    url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

/**
 * Exports a revision note to Google Keep (enterprise accounts) with automatic fallback
 * to a Google Drive Keep-formatted note file for consumer @gmail.com accounts.
 */
export async function exportRevisionToGoogleKeepOrDrive(
  title: string,
  bodyTextOrLines: string | string[]
): Promise<{ mode: 'keep' | 'drive_note'; target: string; urlOrId: string }> {
  const token = await ensureToken();
  const bodyText = Array.isArray(bodyTextOrLines)
    ? bodyTextOrLines.join('\n• ')
    : bodyTextOrLines;

  // Attempt Google Keep API first
  try {
    const keepRes = await fetch('https://keep.googleapis.com/v1/notes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body: {
          text: {
            text: bodyText,
          },
        },
      }),
    });
    if (keepRes.ok) {
      const data = await keepRes.json();
      return { mode: 'keep', target: 'Google Keep', urlOrId: data.name || 'keep_note' };
    }
  } catch {
    // Fall through to Drive Note creation for consumer @gmail.com accounts
  }

  // Create a Keep-compatible quick note in Google Drive using drive.file scope
  const metadata = {
    name: `${title} — LearnMate Keep Note.txt`,
    mimeType: 'text/plain',
  };
  const boundary = 'learnmate_keep_boundary';
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${title}\n\n${bodyText}\r\n` +
    `--${boundary}--`;

  const driveRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );
  if (!driveRes.ok) {
    throw new Error(`Failed to save note (${driveRes.status})`);
  }
  const driveFile = await driveRes.json();
  return {
    mode: 'drive_note',
    target: 'Google Drive Keep Note',
    urlOrId: driveFile.id,
  };
}

export async function syncStudyTasksWithCalendarAndTasks(
  tasks: { title: string; durationMin: number }[]
): Promise<{ tasksCreated: number }> {
  let count = 0;
  for (const t of tasks) {
    await syncTaskToGoogleWorkspace(t.title, 'JEE');
    count += 1;
  }
  return { tasksCreated: count };
}

export async function exportMindMapToGoogleSlides(
  chapterTitle: string,
  nodes: { title: string; definition: string; trap: string }[]
): Promise<{ presentationId: string; url: string }> {
  return exportRevisionToGoogleSlides(
    chapterTitle,
    nodes.map((n) => ({ title: n.title, body: n.definition, trap: n.trap }))
  );
}

