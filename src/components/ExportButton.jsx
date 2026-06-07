import { jsPDF } from 'jspdf';

export default function ExportButton({ language, bookTitle, pageImages, prominent }) {
  function handleExport() {
    // Zbierz wszystkie strony z localStorage dla tego języka
    const pages = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const match = key?.match(/^uanna_page_(\d+)_([a-z]+)$/);
      if (match && match[2] === language) {
        try {
          pages.push({ pageNum: parseInt(match[1]), data: JSON.parse(localStorage.getItem(key)) });
        } catch {}
      }
    }
    pages.sort((a, b) => a.pageNum - b.pageNum);

    if (pages.length === 0) {
      alert('Brak przetłumaczonych stron. Przejdź przez kilka stron najpierw.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 18;
    const pageW = 210;
    const contentW = pageW - 2 * margin;
    const pageH = 297;
    let y = margin;

    function checkBreak(needed = 8) {
      if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
    }

    function writeText(text, size, bold = false, colorR = 30, colorG = 30, colorB = 30) {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(colorR, colorG, colorB);
      const lines = doc.splitTextToSize(String(text || ''), contentW);
      const lh = size * 0.42;
      checkBreak(lines.length * lh + 3);
      doc.text(lines, margin, y);
      y += lines.length * lh + 3;
    }

    function writeSectionTitle(label) {
      checkBreak(12);
      doc.setFillColor(240, 235, 220);
      doc.rect(margin - 2, y - 4, contentW + 4, 7, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 80, 30);
      doc.text(label.toUpperCase(), margin, y);
      y += 6;
    }

    function writeDivider() {
      checkBreak(5);
      doc.setDrawColor(200, 180, 120);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
    }

    // Strona tytułowa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(140, 100, 30);
    doc.text('UANNA', margin, 40);
    doc.setFontSize(13);
    doc.setTextColor(60, 50, 40);
    doc.text(bookTitle || 'Nauczyciel języka z Twoich ulubionych tekstów', margin, 52);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 110, 100);
    doc.text(`Język: ${language === 'ru' ? 'rosyjski' : 'angielski'}`, margin, 62);
    doc.text(`Przetłumaczonych stron: ${pages.length}`, margin, 69);
    doc.text(`Data eksportu: ${new Date().toLocaleDateString('pl-PL')}`, margin, 76);
    doc.text('Autor: Albert Jerka', margin, 83);

    pages.forEach(({ pageNum, data }) => {
      doc.addPage();
      y = margin;

      // Nagłówek strony
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 140, 80);
      doc.text(`${bookTitle || 'UANNA'} · Strona ${pageNum} · ${language.toUpperCase()}`, margin, y);
      y += 8;
      writeDivider();

      // Tłumaczenie polskie
      writeSectionTitle('Tłumaczenie polskie');
      writeText(data.polish_translation, 11, false, 30, 30, 30);
      y += 4;
      writeDivider();

      // Słowniczek
      if (data.vocabulary?.length) {
        writeSectionTitle('Słowniczek');
        data.vocabulary.forEach(v => {
          checkBreak(14);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(40, 70, 120);
          doc.text(v.word || '', margin, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          doc.text(`  →  ${v.translation || ''}`, margin + doc.getTextWidth(v.word || '') + 1, y);
          y += 5;
          if (v.note) {
            doc.setFontSize(8);
            doc.setTextColor(130, 120, 100);
            const noteLines = doc.splitTextToSize(v.note, contentW - 4);
            doc.text(noteLines, margin + 4, y);
            y += noteLines.length * 3.5 + 1;
          }
        });
        y += 3;
        writeDivider();
      }

      // Kontekst
      if (data.context) {
        writeSectionTitle('Kontekst i objaśnienia');
        if (data.context.summary) writeText(data.context.summary, 10, false, 80, 70, 50);
        data.context.notes?.forEach(note => {
          checkBreak(10);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 90, 70);
          const lines = doc.splitTextToSize(`• ${note}`, contentW - 4);
          doc.text(lines, margin + 2, y);
          y += lines.length * 4 + 2;
        });
        y += 2;
        writeDivider();
      }

      // Zdanie po zdaniu
      if (data.sentences?.length) {
        writeSectionTitle('Zdanie po zdaniu');
        data.sentences.forEach((s, idx) => {
          checkBreak(18);
          writeText(s.original, 10, false, 30, 50, 80);
          writeText(s.polish, 9.5, false, 100, 90, 70);
          y += 2;
        });
        writeDivider();
      }

      // Obrazki dla tej strony
      const imgs = pageImages?.[pageNum];
      if (imgs?.length) {
        writeSectionTitle('Obrazki');
        imgs.forEach(dataUrl => {
          try {
            const format = dataUrl.match(/data:image\/(\w+)/)?.[1]?.toUpperCase() || 'JPEG';
            const safeFormat = ['JPEG', 'PNG', 'WEBP'].includes(format) ? format : 'JPEG';
            const imgW = Math.min(contentW, 100);
            const imgH = 70;
            checkBreak(imgH + 5);
            doc.addImage(dataUrl, safeFormat, margin, y, imgW, imgH);
            y += imgH + 5;
          } catch {}
        });
      }
    });

    const date = new Date().toISOString().slice(0, 10);
    const safe = (bookTitle || 'dokument').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _-]/g, '');
    doc.save(`UANNA_${safe}_${date}.pdf`);
  }

  return (
    <button
      className={prominent ? 'btn-export-prominent' : 'btn-export'}
      onClick={handleExport}
      title="Eksportuj wszystkie przetłumaczone strony do PDF"
    >
      ↓ Pobierz PDF
    </button>
  );
}
