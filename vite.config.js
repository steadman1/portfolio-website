import { defineConfig } from "vite"
import Three from "three";
import Tween from "@tweenjs/tween.js";
import Stats from "stats.js"

export default defineConfig({
    base: "/portfolio",
    plugins: [Three(), Tween(), Stats()]
})
