import { jsPDF } from 'jspdf';

export interface ReportItem {
  id: string;
  title: string;
  severity: string;
  category: string;
  filePath: string;
  lineRange?: string | number | null;
  description: string;
  ruleId?: string | null;
  analyzer?: string | null;
  remediation?: string | null;
  codeExcerpt?: string | null;
  rootCause?: string | null;
  proposedFix?: string | null;
  suggestedFix?: string | null;
  verificationStatus?: string | null;
  errorDetails?: string | null;
}

export interface ReportMetadata {
  repositoryName: string;
  branch?: string;
  commitSha?: string;
  codeHealth?: number | null;
  generatedAt?: string;
  author?: string;
}

export function generateIssuesPdfReport(
  items: ReportItem[],
  metadata: ReportMetadata
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 15;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      currentY = 16;
      drawHeaderFooter();
    }
  };

  const drawHeaderFooter = () => {
    // Top border line
    doc.setDrawColor(139, 92, 246); // TeamPulse purple
    doc.setLineWidth(0.8);
    doc.line(margin, 10, pageWidth - margin, 10);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(
      `TeamPulse — Automated Code Quality, Security & Error Audit Report`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Page ${doc.getCurrentPageInfo().pageNumber}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  };

  // --- Title & Banner ---
  doc.setFillColor(18, 18, 24);
  doc.rect(margin, currentY, contentWidth, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(250, 250, 250);
  doc.text('TeamPulse — Issues & Error Diagnostic Audit Report', margin + 4, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(161, 161, 170);
  const nowStr = metadata.generatedAt || new Date().toUTCString();
  doc.text(`Repository: ${metadata.repositoryName} | Generated: ${nowStr}`, margin + 4, currentY + 18);

  currentY += 32;

  // --- Executive Summary Box ---
  const criticalCount = items.filter((i) => i.severity.toLowerCase() === 'critical').length;
  const highCount = items.filter((i) => i.severity.toLowerCase() === 'high').length;
  const mediumCount = items.filter((i) => i.severity.toLowerCase() === 'medium').length;
  const lowCount = items.filter((i) => i.severity.toLowerCase() === 'low' || i.severity.toLowerCase() === 'informational').length;

  doc.setDrawColor(39, 39, 42);
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

  const colW = contentWidth / 5;

  const renderStat = (x: number, label: string, val: string | number, color: [number, number, number]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 160);
    doc.text(label.toUpperCase(), x + colW / 2, currentY + 7, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(String(val), x + colW / 2, currentY + 16, { align: 'center' });
  };

  renderStat(margin, 'Total Issues', items.length, [250, 250, 250]);
  renderStat(margin + colW, 'Critical', criticalCount, [239, 68, 68]);
  renderStat(margin + colW * 2, 'High', highCount, [245, 158, 11]);
  renderStat(margin + colW * 3, 'Medium', mediumCount, [59, 130, 246]);
  renderStat(margin + colW * 4, 'Low / Info', lowCount, [161, 161, 170]);

  currentY += 28;

  // Metadata specifics
  if (metadata.branch || metadata.commitSha || metadata.codeHealth !== undefined) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(113, 113, 122);
    let metaLine = '';
    if (metadata.branch) metaLine += `Target Branch: ${metadata.branch}    `;
    if (metadata.commitSha) metaLine += `Target Commit: ${metadata.commitSha}    `;
    if (metadata.codeHealth !== undefined && metadata.codeHealth !== null) metaLine += `Code Health Score: ${metadata.codeHealth}/100`;
    doc.text(metaLine, margin, currentY);
    currentY += 6;
  }

  // Section Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(250, 250, 250);
  doc.text(`Identified Defects, Errors & Diagnostic Findings (${items.length})`, margin, currentY);
  currentY += 5;

  doc.setDrawColor(63, 63, 70);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  if (items.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(161, 161, 170);
    doc.text('No unresolved issues or errors detected in this repository scan.', margin, currentY);
    drawHeaderFooter();
    doc.save(`${metadata.repositoryName.replace(/[^a-zA-Z0-9_-]/g, '_')}_issues_error_report.pdf`);
    return;
  }

  // --- Render Findings ---
  items.forEach((item, index) => {
    checkPageBreak(45);

    // Finding Card container
    const cardStartY = currentY;

    // Severity indicator badge color
    const sev = item.severity.toLowerCase();
    let badgeColor: [number, number, number] = [161, 161, 170];
    if (sev === 'critical') badgeColor = [239, 68, 68];
    else if (sev === 'high') badgeColor = [245, 158, 11];
    else if (sev === 'medium') badgeColor = [59, 130, 246];

    // Card background
    doc.setFillColor(20, 20, 26);
    doc.setDrawColor(39, 39, 42);
    doc.roundedRect(margin, cardStartY, contentWidth, 7, 1, 1, 'F');

    // Number & Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(250, 250, 250);
    const titleText = `${index + 1}. ${item.title}`;
    const truncatedTitle = titleText.length > 70 ? titleText.slice(0, 67) + '...' : titleText;
    doc.text(truncatedTitle, margin + 3, cardStartY + 5);

    // Severity and Verification status pills
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let rightOffset = pageWidth - margin - 3;

    doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.text(item.severity.toUpperCase(), rightOffset, cardStartY + 5, { align: 'right' });

    if (item.verificationStatus) {
      const vText = `[${item.verificationStatus.toUpperCase()}]`;
      const isVerified = item.verificationStatus.toLowerCase().includes('verified');
      doc.setTextColor(isVerified ? 16 : 245, isVerified ? 185 : 158, isVerified ? 129 : 11);
      doc.text(vText, rightOffset - 22, cardStartY + 5, { align: 'right' });
    }

    currentY += 10;

    // Location & Category & Analyzer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(139, 92, 246);
    let locText = `File: ${item.filePath}${item.lineRange ? ` (Line ${item.lineRange})` : ''}  |  Category: ${item.category}`;
    if (item.ruleId) locText += `  |  Rule: ${item.ruleId}`;
    if (item.analyzer) locText += `  |  Engine: ${item.analyzer}`;
    doc.text(locText, margin + 3, currentY);
    currentY += 5;

    // Description / Error Message
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(212, 212, 216);
    const descLines = doc.splitTextToSize(item.description || 'No description provided.', contentWidth - 6);
    doc.text(descLines, margin + 3, currentY);
    currentY += descLines.length * 4.2 + 2;

    // Root Cause & Diagnosis if present
    if (item.rootCause) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(245, 158, 11); // Amber
      doc.text('AI Root-Cause Diagnosis:', margin + 3, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(228, 228, 231);
      const rootCauseLines = doc.splitTextToSize(item.rootCause, contentWidth - 6);
      doc.text(rootCauseLines, margin + 3, currentY);
      currentY += rootCauseLines.length * 3.8 + 2;
    }

    // Error details / Stack trace if present
    if (item.errorDetails) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(239, 68, 68); // Red
      doc.text('Diagnostic Error Details:', margin + 3, currentY);
      currentY += 4;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(254, 202, 202);
      doc.setFillColor(30, 15, 15);
      const errLines = doc.splitTextToSize(item.errorDetails.trim(), contentWidth - 8);
      const errH = errLines.length * 3.4 + 4;
      doc.rect(margin + 2, currentY, contentWidth - 4, errH, 'F');
      doc.text(errLines, margin + 4, currentY + 3.5);
      currentY += errH + 3;
    }

    // Remediation / Suggested Fix if present
    if (item.remediation || item.suggestedFix) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(16, 185, 129); // Green
      doc.text('Recommended Remediation:', margin + 3, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 190);
      const remLines = doc.splitTextToSize(item.remediation || item.suggestedFix || '', contentWidth - 6);
      doc.text(remLines, margin + 3, currentY);
      currentY += remLines.length * 3.8 + 2;
    }

    // Problematic Code Excerpt if present
    if (item.codeExcerpt) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(161, 161, 170);
      doc.text('Code Excerpt (Detected Defect):', margin + 3, currentY);
      currentY += 3.5;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(167, 139, 250);
      doc.setFillColor(12, 12, 15);
      const snippetLines = doc.splitTextToSize(item.codeExcerpt.trim(), contentWidth - 8);
      const snippetH = Math.min(snippetLines.length * 3.4 + 4, 45); // cap excerpt height if giant
      doc.rect(margin + 2, currentY, contentWidth - 4, snippetH, 'F');
      doc.text(snippetLines.slice(0, 12), margin + 4, currentY + 3.5);
      currentY += snippetH + 3;
    }

    // Proposed Fix / Verified Patch Code if present
    if (item.proposedFix && item.proposedFix !== item.codeExcerpt) {
      checkPageBreak(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(56, 189, 248); // Sky blue
      doc.text('Proposed Fix / Transformed Code:', margin + 3, currentY);
      currentY += 3.5;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(186, 230, 253);
      doc.setFillColor(15, 23, 42);
      const fixLines = doc.splitTextToSize(item.proposedFix.trim(), contentWidth - 8);
      const fixH = Math.min(fixLines.length * 3.4 + 4, 45);
      doc.rect(margin + 2, currentY, contentWidth - 4, fixH, 'F');
      doc.text(fixLines.slice(0, 12), margin + 4, currentY + 3.5);
      currentY += fixH + 3;
    }

    currentY += 4; // Space between cards
  });

  // Stamp header & footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawHeaderFooter();
  }

  // Trigger download
  const safeFilename = `${metadata.repositoryName.replace(/[^a-zA-Z0-9_-]/g, '_')}_issues_error_report.pdf`;
  doc.save(safeFilename);
}
