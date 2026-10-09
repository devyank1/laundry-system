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
  const maxWidth = pageWidth - imgMargin * 2;
  const maxHeight = pageHeight - 30;
  const viewBox = svg.viewBox.baseVal;
  const svgAspect = (viewBox.width || svg.clientWidth) / (viewBox.height || svg.clientHeight);

  let imgWidth = maxWidth;
  let imgHeight = imgWidth / svgAspect;
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = imgHeight * svgAspect;
  }
  const imgX = imgMargin + (maxWidth - imgWidth) / 2;

  doc.addImage(pngDataUrl, "PNG", imgX, 24, imgWidth, imgHeight, undefined, "FAST");

  doc.save(filename);
}

function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  const PIXEL_RATIO = 3;
  return new Promise((resolve, reject) => {
    const viewBox = svg.viewBox.baseVal;
    const baseWidth = viewBox.width || svg.clientWidth;
    const baseHeight = viewBox.height || svg.clientHeight;
    const targetWidth = baseWidth * PIXEL_RATIO;
    const targetHeight = baseHeight * PIXEL_RATIO;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(targetWidth));
    clone.setAttribute("height", String(targetHeight));

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
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
