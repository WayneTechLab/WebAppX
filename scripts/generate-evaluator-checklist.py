#!/usr/bin/env python3
"""Generate the one-page public paper worksheet (optional ReportLab dependency)."""
from pathlib import Path
import os
import tempfile

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/pdf/portal-evaluator-checklist.pdf'
NAVY = colors.HexColor('#15263D')
TEAL = colors.HexColor('#007B83')
GRAY = colors.HexColor('#546475')
LINE = colors.HexColor('#BDCCD6')
PALE = colors.HexColor('#EDF5F7')


def build():
    for directory in (ROOT / 'output', OUTPUT.parent):
        if directory.is_symlink() or directory.exists() and not directory.is_dir():
            raise ValueError('Worksheet output directory must be an unlinked directory')
    if OUTPUT.is_symlink() or OUTPUT.exists() and not OUTPUT.is_file():
        raise ValueError('Worksheet output must be an unlinked regular file')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.worksheet-', suffix='.pdf', dir=OUTPUT.parent)
    os.close(descriptor)
    try:
        document = canvas.Canvas(temporary, pagesize=A4, invariant=1, pageCompression=1)
        document.setTitle('WebAppX account-free portal evaluator worksheet')
        document.setAuthor('Wayne Tech Lab')
        document.setSubject('Fictional HR, CMS, CRM and selected workspace recovery evaluation')
        width, height = A4
        left, right = 40, width - 40

        def text(x, y, value, size=9, font='Helvetica', color=NAVY):
            document.setFillColor(color)
            document.setFont(font, size)
            document.drawString(x, y, value)

        def line(y, x=left, end=right):
            document.setStrokeColor(LINE)
            document.setLineWidth(.55)
            document.line(x, y, end, y)

        def field(label, x, y, end):
            text(x, y + 4, label, 7.5, color=GRAY)
            line(y - 13, x, end)

        def section(number, y, title, duration, instructions, expected):
            document.setFillColor(PALE)
            document.roundRect(left, y - 25, right - left, 30, 5, fill=1, stroke=0)
            text(left + 10, y - 14, f'{number:02d}  {title}', 11, 'Helvetica-Bold')
            document.setFont('Helvetica', 8)
            document.setFillColor(TEAL)
            document.drawRightString(right - 10, y - 13, duration)
            baseline = y - 42
            for index, instruction in enumerate(instructions):
                document.setStrokeColor(GRAY)
                document.setLineWidth(.7)
                document.rect(left + 1, baseline - index * 14 - 1, 7, 7, fill=0, stroke=1)
                text(left + 16, baseline - index * 14, instruction, 8.7)
            expected_y = baseline - len(instructions) * 14 - 1
            text(left, expected_y, 'Expect: ' + expected, 8.1, color=TEAL)
            text(left, expected_y - 18, 'Observed / evidence:', 7.5, color=GRAY)
            line(expected_y - 21, left + 81)
            return expected_y - 36

        document.setFillColor(NAVY)
        document.rect(0, height - 92, width, 92, fill=1, stroke=0)
        text(left, height - 34, 'WEBAPPX', 10, 'Helvetica-Bold', colors.HexColor('#6AD5D0'))
        text(left, height - 58, 'Portal evaluator worksheet', 22, 'Helvetica-Bold', colors.white)
        text(left, height - 77, 'Account-free evaluation  /  fictional records  /  paper checklist', 9,
             color=colors.HexColor('#DFEAF1'))

        field('Evaluator / date', left, height - 116, left + 228)
        field('Source commit / build', left + 250, height - 116, right)
        field('Exact browser origin - scheme + hostname + port', left, height - 151, right)
        text(left, height - 182, 'Use a fresh evaluation browser context; retain your existing browser saves.', 8.5)
        text(left, height - 196, 'Follow docs/demos for actors, exact controls and full expected records. Tick after observing.', 8.3,
             color=GRAY)

        y = height - 221
        y = section(1, y, 'HR - onboarding to mock payroll', 'Designed for 5 min', [
            'Onboard Jordan; enroll Avery in Health and waive Jordan retirement.',
            'Choose Oct 1-15, 2026; set Avery/Jordan at fictional $30/hour from Oct 1.',
            'Submit/approve seed time plus Avery 1.25h and Jordan 2.50h; submit mock payroll.',
        ], '17.75h; $532.50 gross; $106.50 illustrative tax; $25 benefits; $401 net.')
        y = section(2, y, 'CMS - separate review and publication', 'Designed for 5 min', [
            'Save revision 2; request a separate review; approve, then publish as publisher.',
            'Edit revision 3 privately; reload and inspect the frozen public preview.',
        ], 'Published revision 2 remains frozen after the later draft edit.')
        y = section(3, y, 'CRM - convert and move an opportunity', 'Designed for 5 min', [
            'Create and qualify the fictional lead; convert it at $1,750.25.',
            'Inspect linked records; move discovery -> proposal -> negotiation.',
        ], 'Linked company/contact/opportunity; $8,250.25 open pipeline.')
        y = section(4, y, 'Recovery - one selected module and Undo', 'Designed for 10 min', [
            'Export all portals; make the documented changes; restore CMS only.',
            'Compare complete exports, then Undo and compare again.',
        ], 'HR/CRM stay unchanged; Undo returns the prior CMS workspace.')

        text(left, y + 2, 'Follow-up / unexpected result / exact download or receipt ID:', 8, 'Helvetica-Bold')
        line(y - 15)
        line(y - 31)
        text(left, 51, 'Seed: webappx-portal-smoke-v1   |   Worksheet reviewed: 2026-10-15', 7.4, color=GRAY)
        seed_digest = (ROOT / 'tests/browser/fixtures/portal-smoke-v1.sha256').read_text().strip().split()[0]
        text(left, 39, 'Seed SHA-256: ' + seed_digest, 6.9, color=GRAY)
        text(left, 27, 'Record observed outcomes. This worksheet does not establish provider, production or legal/tax readiness.', 7.1,
             color=GRAY)
        document.showPage()
        document.save()
        os.replace(temporary, OUTPUT)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('Generated output/pdf/portal-evaluator-checklist.pdf')


if __name__ == '__main__':
    build()
