import { useEffect, useState } from "react";

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 520);
    useEffect(() => {
        const update = () => setIsMobile(window.innerWidth <= 520);
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);
    return isMobile;
}
