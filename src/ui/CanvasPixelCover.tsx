import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
    src: string;
    revealStep: number;
    steps?: number[];
    size?: number;
};

export function CanvasPixelCover({ src, revealStep, steps, size = 320 }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [img, setImg] = useState<HTMLImageElement | null>(null);

    const blockSteps = useMemo(() => steps ?? [48, 32, 24, 16, 10, 6], [steps]);
    const block = blockSteps[Math.min(Math.max(revealStep, 0), blockSteps.length - 1)];

    useEffect(() => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => setImg(i);
        i.src = src;
    }, [src]);

    useEffect(() => {
        if (!img) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        const sw = Math.max(1, Math.floor(w / block));
        const sh = Math.max(1, Math.floor(h / block));

        const off = document.createElement("canvas");
        off.width = sw;
        off.height = sh;

        const octx = off.getContext("2d");
        if (!octx) return;

        octx.imageSmoothingEnabled = true;
        octx.clearRect(0, 0, sw, sh);
        octx.drawImage(img, 0, 0, sw, sh);

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(off, 0, 0, sw, sh, 0, 0, w, h);
    }, [img, block]);

    return (
        <div style={{ width: size, height: size, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
            <canvas ref={canvasRef} width={size} height={size} />
        </div>
    );
}
