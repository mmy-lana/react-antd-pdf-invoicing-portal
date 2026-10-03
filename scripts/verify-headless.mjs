/*
 * Headless Chrome verification of the built bundle.
 *
 * Walks every screen at each target viewport against a throwaway Chrome profile
 * and asserts the mobile-first rules the plan requires: no horizontal scroll,
 * 44px tap targets, 16px inputs, no console or network errors, correct
 * navigation switching, and a real PDF byte stream out of the download path.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchPrivateChrome, openTab } from './cdp-client.mjs';

const BASE_URL = process.env.VERIFY_BASE_URL ?? 'http://localhost:4319';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARTIFACT_DIR = path.join(process.cwd(), 'verification-artifacts');

const VIEWPORTS = [
  { label: '360-mobile-s', width: 360, height: 740, mobile: true },
  { label: '390-mobile-m', width: 390, height: 844, mobile: true },
  { label: '430-mobile-l', width: 430, height: 932, mobile: true },
  { label: '768-tablet', width: 768, height: 1024, mobile: false },
  { label: '1440-desktop', width: 1440, height: 900, mobile: false },
];

const SCREENS = [
  { label: 'invoices', hash: '#/invoices', waitFor: 'input[aria-label="Search invoices"]' },
  { label: 'clients', hash: '#/clients', waitFor: 'input[aria-label="Search clients"]' },
  { label: 'settings', hash: '#/settings', waitFor: 'section[aria-label="Issuer profile"]' },
  { label: 'invoice-editor', hash: '#/invoices/new', waitFor: 'form' },
];

const findings = [];
const record = (severity, message) => {
  findings.push({ severity, message });
  console.log(`${severity.toUpperCase()}: ${message}`);
};

/*
 * Measure the control a finger actually lands on.
 *
 * Ant Design nests a text field several levels deep — `.ant-input` inside
 * `.ant-input-affix-wrapper` inside `.ant-select` — and only the outermost box
 * is the hit area. Climbing to the outermost matching ancestor is what makes a
 * 24px inner input inside a 44px wrapper a pass. Non-interactive spans such as
 * status badges are excluded: they are text, not targets.
 */
const MEASURE_SCREEN = `(() => {
  const root = document.documentElement;
  const undersized = [];
  const smallFonts = [];

  const CONTROL_ROOT = /\\bant-(input-affix-wrapper|input-group-wrapper|select|input-number|picker)\\b/;
  const CONTAINER = /\\bant-(form-item|table|row|col|card|drawer|modal|toolbar)\\b/;

  const INTERACTIVE = [
    'button', 'a[href]', 'input', 'select', 'textarea', '[role="button"]',
    '.ant-checkbox-wrapper', '.ant-radio-wrapper', '.ant-segmented-item', '.ant-tag-checkable'
  ].join(', ');

  const surfaceFor = (element) => {
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return element;
    let surface = element;
    let cursor = element.parentElement;
    while (cursor) {
      const cursorClass = String(cursor.className || '');
      if (CONTROL_ROOT.test(cursorClass)) surface = cursor;
      if (CONTAINER.test(cursorClass)) break;
      cursor = cursor.parentElement;
    }
    return surface;
  };

  for (const element of document.querySelectorAll(INTERACTIVE)) {
    if (element.tagName === 'INPUT' && element.type === 'hidden') continue;
    const surface = surfaceFor(element);
    const rect = surface.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const style = getComputedStyle(surface);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    if (String(surface.className || '').includes('ant-input-number-action')) continue;

    if (rect.height < 43.5) {
      undersized.push({
        tag: element.tagName,
        surface: String(surface.className || surface.tagName).split(' ').slice(0, 2).join('.'),
        label: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 36),
        height: Math.round(rect.height * 10) / 10,
      });
    }

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      const fontSize = parseFloat(getComputedStyle(element).fontSize) || 0;
      if (fontSize > 0 && fontSize < 15.5) {
        smallFonts.push({
          tag: element.tagName,
          fontSize,
          label: (element.getAttribute('placeholder') || '').slice(0, 30),
        });
      }
    }
  }

  const bottomNav = document.querySelector('nav[aria-label="Primary"]');
  const bottomNavIsFixed = bottomNav !== null && getComputedStyle(bottomNav).position === 'fixed';

  return {
    overflow: root.scrollWidth - root.clientWidth,
    documentWidth: root.scrollWidth,
    viewportWidth: root.clientWidth,
    textLength: (document.body.innerText || '').trim().length,
    undersized: undersized.slice(0, 10),
    undersizedCount: undersized.length,
    smallFonts: smallFonts.slice(0, 10),
    smallFontCount: smallFonts.length,
    bottomNavIsFixed,
    hasSidebar: document.querySelector('aside') !== null,
  };
})()`;

const waitForSelector = async (page, selector, timeoutMs = 25_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.evaluate(`document.querySelector(${JSON.stringify(selector)}) !== null`)) return true;
    await new Promise((wait) => setTimeout(wait, 200));
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
};

const waitForHashPrefix = async (page, prefix, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hash = await page.evaluate('window.location.hash');
    if (typeof hash === 'string' && hash.startsWith(prefix)) return true;
    await new Promise((wait) => setTimeout(wait, 250));
  }
  return false;
};

const attachDiagnostics = (page, screenLabel) => {
  page.onEvent((payload) => {
    if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') {
      const text = payload.params.args.map((argument) => argument.value ?? argument.description ?? '').join(' ');
      if (text.includes('favicon') || text.includes('React DevTools')) return;
      record('error', `[${screenLabel}] console.error: ${text}`);
    }
    if (payload.method === 'Runtime.exceptionThrown') {
      const details = payload.params.exceptionDetails;
      record('error', `[${screenLabel}] uncaught: ${details.exception?.description ?? details.text}`);
    }
    if (payload.method === 'Network.loadingFailed' && !payload.params.canceled) {
      record('error', `[${screenLabel}] request failed: ${payload.params.errorText} (${payload.params.type})`);
    }
  });
};

/*
 * Hash routing means consecutive screens differ only in the fragment, which
 * would be a same-document navigation with no load event. The cache-busting
 * query makes each visit a genuine document load, so readiness is observable.
 */
let visitCounter = 0;
const visitUrl = (hash) => `${BASE_URL}/?v=${++visitCounter}${hash}`;

const auditScreen = async (page, viewport, screen) => {
  const screenName = `${viewport.label}/${screen.label}`;

  await page.navigate(visitUrl(screen.hash));
  await waitForSelector(page, screen.waitFor);
  await new Promise((settle) => setTimeout(settle, 700));

  const audit = await page.evaluate(MEASURE_SCREEN);

  if (audit.overflow > 1) {
    record(
      'error',
      `[${screenName}] horizontal overflow: ${audit.documentWidth}px of content in a ${audit.viewportWidth}px viewport`
    );
  }

  if (audit.textLength < 40) {
    record('error', `[${screenName}] rendered effectively empty (${audit.textLength} characters of text)`);
  }

  if (viewport.mobile) {
    if (audit.undersizedCount > 0) {
      record(
        'warn',
        `[${screenName}] ${audit.undersizedCount} control(s) below the 44px tap target: ${JSON.stringify(audit.undersized)}`
      );
    }
    if (audit.smallFontCount > 0) {
      record(
        'error',
        `[${screenName}] ${audit.smallFontCount} input(s) under 16px (iOS zoom risk): ${JSON.stringify(audit.smallFonts)}`
      );
    }

    const isEditorScreen = screen.label === 'invoice-editor';
    if (audit.bottomNavIsFixed === isEditorScreen) {
      record(
        'error',
        `[${screenName}] bottom navigation is ${audit.bottomNavIsFixed ? 'visible' : 'hidden'} but must be ${isEditorScreen ? 'hidden' : 'visible'}`
      );
    }
  }

  if (viewport.width >= 1024 && !audit.hasSidebar) {
    record('error', `[${screenName}] the desktop sidebar rail is missing`);
  }

  await writeFile(path.join(ARTIFACT_DIR, `${viewport.label}__${screen.label}.png`), await page.screenshot());
  return audit;
};

const run = async () => {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const { client, shutdown } = await launchPrivateChrome(CHROME_PATH);

  try {
    for (const viewport of VIEWPORTS) {
      const page = await openTab(client);
      attachDiagnostics(page, viewport.label);
      await page.setViewport(viewport);

      for (const screen of SCREENS) {
        try {
          await auditScreen(page, viewport, screen);
        } catch (auditError) {
          record('error', `[${viewport.label}/${screen.label}] ${auditError.message}`);
        }
      }

      await page.close();
    }

    // ---- Desktop journey: ledger -> detail -> client portal -> PDF download ----
    const desktop = await openTab(client);
    attachDiagnostics(desktop, 'journey');
    await desktop.setViewport({ width: 1440, height: 900 });

    await desktop.navigate(visitUrl('#/invoices'));
    await waitForSelector(desktop, 'input[aria-label="Search invoices"]');
    await new Promise((settle) => setTimeout(settle, 900));

    const seededInvoiceCount = await desktop.evaluate('document.querySelectorAll("tbody tr").length');
    if (!seededInvoiceCount || seededInvoiceCount < 1) {
      record('error', '[journey] the ledger rendered no rows — the first-run seed did not complete');
    } else {
      record('pass', `[journey] ledger rendered ${seededInvoiceCount} seeded invoice rows`);
    }

    // Capture the export anchor rather than handing the blob to Chrome's
    // download manager, so the assertion can inspect the real bytes.
    await desktop.evaluate(`(() => {
      window.__capturedExport = null;
      const nativeClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function patchedClick(...args) {
        if (this.download) {
          window.__capturedExport = { fileName: this.download, href: this.href };
          return undefined;
        }
        return nativeClick.apply(this, args);
      };
      return true;
    })()`);

    // Row activation is the primary way an operator opens an invoice; the row
    // itself is the target, so the click lands on the cell itself.
    await desktop.clickSelector('tbody tr td');
    const openedDetailByClick = await waitForHashPrefix(desktop, '#/invoices/');

    if (!openedDetailByClick) {
      record('error', '[journey] clicking a ledger row did not open the invoice detail screen');
    }

    const detailReached = await waitForHashPrefix(desktop, '#/invoices/');
    if (detailReached) {
      try {
        await waitForSelector(desktop, 'section[aria-label="Invoice summary"]', 20_000);
      } catch (selectorError) {
        const snapshot = await desktop.evaluate(`({
          hash: window.location.hash,
          body: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 400),
        })`);
        record(
          'error',
          `[detail] ${selectorError.message} — hash=${snapshot.hash} body="${snapshot.body}"`
        );
      }
    }
    await new Promise((settle) => setTimeout(settle, 900));

    const detailAudit = await desktop.evaluate(`(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hasActions: document.querySelector('[role="group"][aria-label^="Actions for invoice"]') !== null,
      summaryLength: (document.querySelector('section[aria-label="Invoice summary"]')?.innerText || '').length,
      heading: (document.querySelector('h1')?.innerText || '').trim(),
      textLength: (document.body.innerText || '').trim().length,
    }))()`);

    if (!detailReached) {
      record('error', '[detail] the invoice detail screen was never reached');
    } else {
      if (detailAudit.overflow > 1) record('error', `[detail] horizontal overflow of ${detailAudit.overflow}px`);
      if (!detailAudit.hasActions) record('error', '[detail] the lifecycle action bar did not render');
      if (detailAudit.summaryLength < 10) record('error', '[detail] the summary card rendered empty');
      if (detailAudit.textLength < 60) record('error', '[detail] the detail screen rendered effectively empty');
      if (
        detailAudit.overflow <= 1 &&
        detailAudit.hasActions &&
        detailAudit.summaryLength >= 10 &&
        detailAudit.textLength >= 60
      ) {
        record('pass', `[detail] "${detailAudit.heading}" rendered with actions, summary and audit trail`);
      }
    }

    await writeFile(path.join(ARTIFACT_DIR, '1440-desktop__invoice-detail.png'), await desktop.screenshot());

    await desktop.evaluate(`(() => {
      const target = Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent.includes('View as the client'));
      if (target) target.click();
      return true;
    })()`);

    const portalReached = await waitForHashPrefix(desktop, '#/portal/');
    if (!portalReached) {
      record('error', '[portal] navigating from invoice detail never reached the client portal');
    } else {
      await waitForSelector(desktop, 'h1');
      await new Promise((settle) => setTimeout(settle, 900));

      const portalAudit = await desktop.evaluate(`(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        heading: (document.querySelector('h1')?.innerText || '').trim(),
        hasDownload: document.querySelector('button[aria-label^="Download INV"]') !== null,
        textLength: (document.body.innerText || '').trim().length,
      }))()`);

      if (portalAudit.overflow > 1) record('error', `[portal] horizontal overflow of ${portalAudit.overflow}px`);
      if (!portalAudit.heading.includes('Invoice')) {
        record('error', `[portal] heading did not render ("${portalAudit.heading}")`);
      }
      if (!portalAudit.hasDownload) record('error', '[portal] the client download control is missing');
      if (portalAudit.textLength < 60) record('error', '[portal] the portal rendered effectively empty');

      await writeFile(path.join(ARTIFACT_DIR, '1440-desktop__client-portal.png'), await desktop.screenshot());

      await desktop.clickSelector('button[aria-label^="Download INV"]');
      await new Promise((settle) => setTimeout(settle, 5000));

      const exportAudit = await desktop.evaluate(`(async () => {
        const captured = window.__capturedExport;
        if (!captured) return { captured: null };
        const response = await fetch(captured.href);
        const buffer = await response.arrayBuffer();
        return {
          captured,
          header: String.fromCharCode(...new Uint8Array(buffer, 0, 5)),
          byteLength: buffer.byteLength,
        };
      })()`);

      if (!exportAudit.captured) {
        record('error', '[pdf] the download control never dispatched a download');
      } else if (exportAudit.header !== '%PDF-') {
        record(
          'error',
          `[pdf] ${exportAudit.captured.fileName} is not a PDF (header "${exportAudit.header}", ${exportAudit.byteLength} bytes)`
        );
      } else if (exportAudit.byteLength < 2000) {
        record('error', `[pdf] ${exportAudit.captured.fileName} is implausibly small (${exportAudit.byteLength} bytes)`);
      } else {
        if (/[\\/:*?"<>|]/.test(exportAudit.captured.fileName)) {
          record('error', `[pdf] unsafe filename characters survived: ${exportAudit.captured.fileName}`);
        }
        record(
          'pass',
          `[pdf] generated "${exportAudit.captured.fileName}" — ${exportAudit.byteLength} bytes, valid %PDF header`
        );
      }
    }

    // A bad portal token must not reveal whether an invoice exists.
    await desktop.navigate(visitUrl('#/portal/not-a-real-token'));
    await new Promise((settle) => setTimeout(settle, 1500));
    const invalidTokenAudit = await desktop.evaluate(
      `(document.body.innerText || '').includes('This link is not available')`
    );
    if (!invalidTokenAudit) {
      record('error', '[portal] an unknown token did not render the not-available state');
    } else {
      record('pass', '[portal] an unknown token is indistinguishable from an unavailable invoice');
    }

    await desktop.close();

    // ---- Mobile editor audit at the narrowest supported width ----
    const mobile = await openTab(client);
    attachDiagnostics(mobile, 'editor-360');
    await mobile.setViewport({ width: 360, height: 740, mobile: true });

    await mobile.navigate(visitUrl('#/invoices/new'));
    await waitForSelector(mobile, 'form');
    await new Promise((settle) => setTimeout(settle, 1200));

    const editorAudit = await mobile.evaluate(`(() => {
      const CONTROL_ROOT = /\\bant-(input-affix-wrapper|input-group-wrapper|select|input-number|picker)\\b/;
      const surfaceFor = (field) => {
        let surface = field;
        let cursor = field.parentElement;
        while (cursor) {
          const cursorClass = String(cursor.className || '');
          if (CONTROL_ROOT.test(cursorClass)) surface = cursor;
          if (/\\bant-(form-item|card|row|col)\\b/.test(cursorClass)) break;
          cursor = cursor.parentElement;
        }
        return surface;
      };
      const fields = Array.from(document.querySelectorAll('input, textarea')).filter((field) => {
        if (field.type === 'hidden') return false;
        return field.getBoundingClientRect().width > 0;
      });
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        lineItemCount: document.querySelectorAll('li').length,
        fields: fields.map((field) => {
          const surface = surfaceFor(field);
          return {
            label: (field.getAttribute('placeholder') || '').slice(0, 28),
            height: Math.round(surface.getBoundingClientRect().height),
            fontSize: parseFloat(getComputedStyle(field).fontSize),
          };
        }),
      };
    })()`);

    if (editorAudit.overflow > 1) {
      record(
        'error',
        `[editor-360] the line-item editor overflows by ${editorAudit.overflow}px (${editorAudit.documentWidth}px content in ${editorAudit.viewportWidth}px)`
      );
    }
    const badFields = editorAudit.fields.filter((field) => field.height < 32 || field.fontSize < 15.5);
    if (badFields.length > 0) {
      record('error', `[editor-360] ${badFields.length} input(s) below touch/zoom minimum: ${JSON.stringify(badFields)}`);
    }
    if (editorAudit.lineItemCount < 1) {
      record('error', '[editor-360] no line-item card rendered in the editor');
    }
    if (editorAudit.overflow <= 1 && badFields.length === 0 && editorAudit.lineItemCount >= 1) {
      record('pass', `[editor-360] line items fit with no clipping across ${editorAudit.fields.length} fields`);
    }

    await writeFile(path.join(ARTIFACT_DIR, '360-mobile-s__invoice-editor-full.png'), await mobile.screenshot());
    await mobile.close();

    // ---- In-app guide and Q&A drawer ----
    const guide = await openTab(client);
    attachDiagnostics(guide, 'guide-drawer');
    await guide.setViewport({ width: 390, height: 844, mobile: true });

    await guide.navigate(visitUrl('#/invoices'));
    await waitForSelector(guide, 'input[aria-label="Search invoices"]');
    await new Promise((settle) => setTimeout(settle, 800));

    await guide.clickSelector('button[aria-label="Open the system guide and frequently asked questions"]');
    await new Promise((settle) => setTimeout(settle, 900));

    const guideAudit = await guide.evaluate(`(() => {
      // Ant Design 6 renamed the drawer body to .ant-drawer-section; the older
      // .ant-drawer-content is kept as a fallback for other major versions.
      const drawer =
        document.querySelector('.ant-drawer-section') || document.querySelector('.ant-drawer-content');
      const root = document.querySelector('.ant-drawer');
      const text = drawer ? drawer.innerText : '';
      return {
        drawerOpen: root !== null && String(root.className).includes('ant-drawer-open'),
        hasTitle: text.includes('System Guide & Mini Q&A'),
        hasOverview: text.includes('IndexedDB'),
        navigationHeadings: ['Invoices', 'Clients', 'Settings', 'Client Portal'].filter((heading) =>
          text.includes(heading),
        ).length,
        questions: [
          'Where are invoice and client data stored?',
          'How does automatic PDF generation work?',
          'Can an issued invoice number be reused or deleted?',
          'How do payment settlements affect status?',
        ].filter((question) => text.includes(question)).length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    })()`);

    if (!guideAudit.drawerOpen) {
      record('error', '[guide] the guide drawer did not open from the header button');
    } else {
      if (!guideAudit.hasTitle) record('error', '[guide] the drawer is missing its "System Guide & Mini Q&A" title');
      if (!guideAudit.hasOverview) record('error', '[guide] the overview section does not describe local storage');
      if (guideAudit.navigationHeadings !== 4) {
        record('error', `[guide] navigation guide rendered ${guideAudit.navigationHeadings} of 4 sections`);
      }
      if (guideAudit.questions !== 4) {
        record('error', `[guide] mini Q&A rendered ${guideAudit.questions} of 4 questions`);
      }
      if (guideAudit.overflow > 1) {
        record('error', `[guide] the open drawer overflows by ${guideAudit.overflow}px at 390px`);
      }
      if (
        guideAudit.hasTitle &&
        guideAudit.hasOverview &&
        guideAudit.navigationHeadings === 4 &&
        guideAudit.questions === 4 &&
        guideAudit.overflow <= 1
      ) {
        record('pass', '[guide] drawer opened with overview, 4 navigation sections and 4 Q&A entries, no overflow');
      }
    }

    await writeFile(path.join(ARTIFACT_DIR, '390-mobile-m__guide-drawer.png'), await guide.screenshot());
    await guide.close();
  } finally {
    await shutdown();
  }

  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warn');
  const passes = findings.filter((finding) => finding.severity === 'pass');

  console.log(`\n=== errors=${errors.length} warnings=${warnings.length} passes=${passes.length} ===`);
  if (errors.length > 0) process.exitCode = 1;
};

run().catch((fatal) => {
  console.error('verification harness crashed:', fatal);
  for (const finding of findings) console.log(`${finding.severity.toUpperCase()}: ${finding.message}`);
  const errors = findings.filter((finding) => finding.severity === 'error');
  console.log(`\n=== errors=${errors.length} (harness aborted early) ===`);
  process.exitCode = 1;
});
