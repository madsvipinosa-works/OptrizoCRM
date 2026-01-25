"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

export const AOSInit = () => {
    useEffect(() => {
        AOS.init({
            once: true,
            duration: 800,
            easing: "ease-out-sine", // Correct easing
            offset: 100,
        });
    }, []);

    return null;
};
