import { useEffect, useMemo, useRef } from "react";

type Props = {
    src: string;
    revealStep: number;
    steps?: number[];
    size?: number;
};

function imageIdFromUrl(url: string): string | null {
    const m = url.match(/\/([^/]+)\.jpg(?:\?.*)?$/i);
    return m ? m[1] : null;
}

function loadImage(url: string, crossOrigin = false): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const i = new Image();
        if (crossOrigin) i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
    });
}

export function CanvasPixelCover({ src, revealStep, steps, size = 320 }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const blockSteps = useMemo(() => steps ?? [48, 32, 24, 16, 10, 6], [steps]);
    const step = Math.min(Math.max(revealStep, 0), blockSteps.length - 1);
    const block = blockSteps[step];

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let cancelled = false;

        const drawDirect = (img: HTMLImageElement) => {
            if (cancelled) return;
            const w = canvas.width;
            const h = canvas.height;
            // img is already a tiny pixelated image from server — just upscale nearest-neighbor
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
        };

        const drawClientSide = (img: HTMLImageElement) => {
            if (cancelled) return;
            const w = canvas.width;
            const h = canvas.height;
            const sw = Math.max(1, Math.floor(w / block));
            const sh = Math.max(1, Math.floor(h / block));
            const off = document.createElement("canvas");
            off.width = sw;
            off.height = sh;
            const octx = off.getContext("2d")!;
            octx.imageSmoothingEnabled = true;
            octx.clearRect(0, 0, sw, sh);
            octx.drawImage(img, 0, 0, sw, sh);
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(off, 0, 0, sw, sh, 0, 0, w, h);
        };

        (async () => {
            const imageId = imageIdFromUrl(src);
            if (imageId) {
                try {
                    const img = await loadImage(`/api/cover/${encodeURIComponent(imageId)}?step=${step}`);
                    drawDirect(img);
                    return;
                } catch {
                    // proxy failed — fall through to client-side
                }
            }
            // fallback: client-side pixelation with original src
            try {
                const img = await loadImage(src, true);
                drawClientSide(img);
            } catch {
                // nothing to draw
            }
        })();

        return () => { cancelled = true; };
    }, [src, step, block, size]);

    return (
        <div style={{ width: size, height: size, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
            <canvas ref={canvasRef} width={size} height={size} />
        </div>
    );
}
