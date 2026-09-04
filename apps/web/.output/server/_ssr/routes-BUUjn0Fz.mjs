import { require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BUUjn0Fz.js
var import_jsx_runtime = require_jsx_runtime();
var realEnv = {
	"BASE_URL": "/",
	"DEV": false,
	"MODE": "production",
	"PROD": true,
	"SSR": true,
	"TSS_DEV_SERVER": "false",
	"TSS_DEV_SSR_STYLES_BASEPATH": "/",
	"TSS_DEV_SSR_STYLES_ENABLED": "true",
	"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
	"TSS_INLINE_CSS_ENABLED": "false",
	"TSS_ROUTER_BASEPATH": "",
	"TSS_SERVER_FN_BASE": "/_serverFn/"
};
function getApiUrl(env = realEnv) {
	return env.VITE_API_URL ?? "http://localhost:3001";
}
function HomePage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Dclic" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Momen yang diabadikan — skeleton daring, galeri menyusul." }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["API: ", getApiUrl()] }) })
	] });
}
//#endregion
export { HomePage as component };
