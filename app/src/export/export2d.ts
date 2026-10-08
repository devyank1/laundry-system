import { downloadDataUrl } from "./download";

export async function exportFloorPlanPNG(svg: SVGSVGElement, filename = "planta-2d.png"): Promise<void> {
  const dataUrl = await svgToPngDataUrl(svg);
  downloadDataUrl(dataUrl, filename);
}

export async function exportFloorPlanPDF(
  svg: SVGSVGElement,
  meta: { projectName: string; areaM2: number },
  filename = "planta-2d.pdf"
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pngDataUrl = await svgToPngDataUrl(svg);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(14);
  doc.text(meta.projectName, 10, 12);
  doc.setFontSize(10);
  doc.text(
    `Área: ${meta.areaM2.toFixed(2)} m² — Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    10,
    18
  );

  const imgMargin = 10;
  const imgWidth = pageWidth - imgMargin * 2;
  const imgHeight = pageHeight - 30;
  doc.addImage(pngDataUrl, "PNG", imgMargin, 24, imgWidth, imgHeight, undefined, "FAST");

  doc.save(filename);
}

function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const viewBox = svg.viewBox.baseVal;
      canvas.width = viewBox.width || svg.clientWidth;
      canvas.height = viewBox.height || svg.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context indisponível."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao converter SVG em imagem."));
    };
    img.src = url;
  });
}
