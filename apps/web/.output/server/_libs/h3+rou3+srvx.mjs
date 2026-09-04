import nodeHTTP from "node:http";
import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import nodeHTTPS from "node:https";
import nodeHTTP2 from "node:http2";
//#region ../../node_modules/.bun/srvx@1.0.3/node_modules/srvx/dist/_chunks/_url.mjs
function lazyInherit(target, source, sourceKey) {
	for (const key of [...Object.getOwnPropertyNames(source), ...Object.getOwnPropertySymbols(source)]) {
		if (key === "constructor") continue;
		const targetDesc = Object.getOwnPropertyDescriptor(target, key);
		const desc = Object.getOwnPropertyDescriptor(source, key);
		let modified = false;
		if (desc.get) {
			modified = true;
			desc.get = targetDesc?.get || function() {
				return this[sourceKey][key];
			};
		}
		if (desc.set) {
			modified = true;
			desc.set = targetDesc?.set || function(value) {
				this[sourceKey][key] = value;
			};
		}
		if (!targetDesc?.value && typeof desc.value === "function") {
			modified = true;
			desc.value = function(...args) {
				return this[sourceKey][key](...args);
			};
		}
		if (modified) Object.defineProperty(target, key, desc);
	}
}
var _needsNormRE = /(?:(?:^|\/)(?:\.|\.\.|%2e|%2e\.|\.%2e|%2e%2e)(?:\/|$))|[\\^#"<>{}`\x00-\x20\x7f-\uffff]/i;
var _searchNeedsNormRE = /[#"'<>\x00-\x20\x7f-\uffff]/;
var FastURL = /* @__PURE__ */ (() => {
	const NativeURL = globalThis.URL;
	const NativeSearchParams = globalThis.URLSearchParams;
	const FastURLSearchParams = class URLSearchParams {
		#owner;
		#params;
		constructor(owner) {
			this.#owner = owner;
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeSearchParams;
		}
		_adopt(params) {
			this.#params = params;
		}
		get _params() {
			if (!this.#params) {
				const search = this.#owner.search;
				this.#params ??= new NativeSearchParams(search);
			}
			return this.#params;
		}
		#mutable() {
			this.#owner._url;
			return this.#params;
		}
		append(name, value) {
			this.#mutable().append(name, value);
		}
		set(name, value) {
			this.#mutable().set(name, value);
		}
		delete(name, value) {
			this.#mutable().delete(name, value);
		}
		sort() {
			this.#mutable().sort();
		}
	};
	lazyInherit(FastURLSearchParams.prototype, NativeSearchParams.prototype, "_params");
	Object.setPrototypeOf(FastURLSearchParams.prototype, NativeSearchParams.prototype);
	Object.setPrototypeOf(FastURLSearchParams, NativeSearchParams);
	const FastURL = class URL {
		#url;
		#href;
		#protocol;
		#host;
		#pathname;
		#search;
		#searchParams;
		#pos;
		constructor(url) {
			if (typeof url === "string") {
				const isOriginForm = url[0] === "/";
				if (isOriginForm && !_searchNeedsNormRE.test(url)) this.#href = `http://localhost${url}`;
				else this.#url = new NativeURL(isOriginForm ? `http://localhost${url}` : url);
			} else if (_needsNormRE.test(url.pathname) || url.search && _searchNeedsNormRE.test(url.search)) this.#url = new NativeURL(`${url.protocol || "http:"}//${url.host || "localhost"}${url.pathname}${url.search || ""}`);
			else {
				this.#protocol = url.protocol;
				this.#host = url.host;
				this.#pathname = url.pathname;
				this.#search = url.search;
			}
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeURL;
		}
		get _url() {
			if (this.#url) return this.#url;
			this.#url = new NativeURL(this.href);
			this.#href = void 0;
			this.#protocol = void 0;
			this.#host = void 0;
			this.#pathname = void 0;
			this.#search = void 0;
			this.#pos = void 0;
			this.#searchParams?._adopt(this.#url.searchParams);
			return this.#url;
		}
		get href() {
			if (this.#url) return this.#url.href;
			if (!this.#href) this.#href = `${this.#protocol || "http:"}//${this.#host || "localhost"}${this.#pathname || "/"}${this.#search || ""}`;
			return this.#href;
		}
		#getPos() {
			if (!this.#pos) {
				const url = this.href;
				const protoIndex = url.indexOf("://");
				const pathnameIndex = protoIndex === -1 ? -1 : url.indexOf("/", protoIndex + 4);
				const qIndex = pathnameIndex === -1 ? -1 : url.indexOf("?", pathnameIndex);
				this.#pos = [
					protoIndex,
					pathnameIndex,
					qIndex
				];
			}
			return this.#pos;
		}
		get pathname() {
			if (this.#url) return this.#url.pathname;
			if (this.#pathname === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.pathname;
				this.#pathname = this.href.slice(pathnameIndex, queryIndex === -1 ? void 0 : queryIndex);
			}
			return this.#pathname;
		}
		get search() {
			if (this.#url) return this.#url.search;
			if (this.#search === void 0) {
				const [, pathnameIndex, queryIndex] = this.#getPos();
				if (pathnameIndex === -1) return this._url.search;
				const url = this.href;
				this.#search = queryIndex === -1 || queryIndex === url.length - 1 ? "" : url.slice(queryIndex);
			}
			return this.#search;
		}
		get searchParams() {
			if (this.#searchParams) return this.#searchParams;
			if (this.#url) return this.#url.searchParams;
			return this.#searchParams = new FastURLSearchParams(this);
		}
		get protocol() {
			if (this.#url) return this.#url.protocol;
			if (this.#protocol === void 0) {
				const [protocolIndex] = this.#getPos();
				if (protocolIndex === -1) return this._url.protocol;
				const url = this.href;
				this.#protocol = url.slice(0, protocolIndex + 1);
			}
			return this.#protocol;
		}
		get hash() {
			if (this.#url) return this.#url.hash;
			return "";
		}
		toString() {
			return this.href;
		}
		toJSON() {
			return this.href;
		}
	};
	lazyInherit(FastURL.prototype, NativeURL.prototype, "_url");
	Object.setPrototypeOf(FastURL.prototype, NativeURL.prototype);
	Object.setPrototypeOf(FastURL, NativeURL);
	return FastURL;
})();
//#endregion
//#region ../../node_modules/.bun/srvx@1.0.3/node_modules/srvx/dist/_chunks/_utils2.mjs
function resolvePortAndHost(opts) {
	const _port = opts.port ?? globalThis.process?.env.PORT ?? 3e3;
	const port = typeof _port === "number" ? _port : Number.parseInt(_port, 10);
	if (Number.isNaN(port) || port < 0 || port > 65535) throw new RangeError(`Port must be a number between 0 and 65535 (got "${_port}").`);
	return {
		port,
		hostname: opts.hostname ?? globalThis.process?.env.HOST
	};
}
function fmtURL(host, port, secure) {
	if (!host || !port) return;
	if (host.includes(":")) host = `[${host}]`;
	return `http${secure ? "s" : ""}://${host}:${port}/`;
}
function printListening(opts, url) {
	if (!url || (opts.silent ?? globalThis.process?.env?.TEST)) return;
	let additionalInfo = "";
	try {
		const _url = new URL(url);
		if (_url.hostname === "[::]" || _url.hostname === "0.0.0.0") {
			_url.hostname = "localhost";
			url = _url.href;
			additionalInfo = " (all interfaces)";
		}
	} catch {}
	let listeningOn = `➜ Listening on:`;
	if (globalThis.process.stdout?.isTTY) {
		listeningOn = `\u001B[32m${listeningOn}\u001B[0m`;
		url = `\u001B[36m${url}\u001B[0m`;
		additionalInfo = `\u001B[2m${additionalInfo}\u001B[0m`;
	}
	console.log(`${listeningOn} ${url}${additionalInfo}`);
}
function resolveTLSOptions(opts) {
	if (!opts.tls || opts.protocol === "http") return;
	const cert = resolveCertOrKey(opts.tls.cert);
	const key = resolveCertOrKey(opts.tls.key);
	if (!cert && !key) {
		if (opts.protocol === "https") throw new TypeError("TLS `cert` and `key` must be provided for `https` protocol.");
		return;
	}
	if (!cert || !key) throw new TypeError("TLS `cert` and `key` must be provided together.");
	return {
		cert,
		key,
		passphrase: opts.tls.passphrase
	};
}
function resolveCertOrKey(value) {
	if (!value) return;
	if (typeof value !== "string") throw new TypeError("TLS certificate and key must be strings in PEM format or file paths.");
	if (value.startsWith("-----BEGIN ")) return value;
	const { readFileSync } = process.getBuiltinModule("node:fs");
	return readFileSync(value, "utf8");
}
function createWaitUntil() {
	const promises = /* @__PURE__ */ new Set();
	return {
		waitUntil: (promise) => {
			if (typeof promise?.then !== "function") return;
			const chained = Promise.resolve(promise).catch(console.error).finally(() => {
				promises.delete(chained);
			});
			promises.add(chained);
		},
		wait: () => {
			return Promise.all(promises);
		},
		get _size() {
			return promises.size;
		}
	};
}
//#endregion
//#region ../../node_modules/.bun/srvx@1.0.3/node_modules/srvx/dist/body-limit.mjs
function limitBodyStream(stream, maxRequestBodySize, options) {
	const createError = options?.createError ?? createBodyTooLargeError;
	const reader = stream.getReader();
	let size = 0;
	return new ReadableStream({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				controller.close();
				return;
			}
			size += value.byteLength;
			if (size > maxRequestBodySize) {
				const error = createError(maxRequestBodySize);
				reader.cancel(error).catch(() => {});
				controller.error(error);
				return;
			}
			controller.enqueue(value);
		},
		cancel(reason) {
			return reader.cancel(reason);
		}
	});
}
function createBodyTooLargeError(maxRequestBodySize) {
	return Object.assign(/* @__PURE__ */ new Error(`Request body exceeds the maximum allowed size of ${maxRequestBodySize} bytes.`), {
		code: "ERR_BODY_TOO_LARGE",
		statusCode: 413,
		status: 413
	});
}
//#endregion
//#region ../../node_modules/.bun/srvx@1.0.3/node_modules/srvx/dist/_chunks/_utils.mjs
var noColor = /* @__PURE__ */ (() => {
	const proc = globalThis.process;
	const env = proc?.env ?? {};
	if (env.FORCE_COLOR) return false;
	if (env.NO_COLOR || env.TERM === "dumb") return true;
	return !proc?.stdout?.isTTY;
})();
var _c = (c, r = 39) => (t) => noColor ? t : `\u001B[${c}m${t}\u001B[${r}m`;
var bold = /* @__PURE__ */ _c(1, 22);
var red = /* @__PURE__ */ _c(31);
var green = /* @__PURE__ */ _c(32);
var gray = /* @__PURE__ */ _c(90);
//#endregion
//#region ../../node_modules/.bun/srvx@1.0.3/node_modules/srvx/dist/_chunks/_plugins.mjs
function wrapFetch(server) {
	let composed = server.options.fetch;
	const middleware = server.options.middleware;
	if (middleware) for (let i = middleware.length - 1; i >= 0; i--) {
		const mw = middleware[i];
		const next = composed;
		composed = (request) => mw(request, () => next(request));
	}
	return composed;
}
var errorPlugin = (server) => {
	const errorHandler = server.options.error;
	if (!errorHandler) return;
	server.options.middleware.unshift((_req, next) => {
		try {
			const res = next();
			return res instanceof Promise ? res.catch((error) => errorHandler(error)) : res;
		} catch (error) {
			return errorHandler(error);
		}
	});
};
var gracefulShutdownPlugin = (server) => {
	const config = server.options?.gracefulShutdown;
	if (!globalThis.process?.on || config === false || config === void 0 && (process.env.CI || process.env.TEST)) return;
	const gracefulTimeout = config === true || !config?.gracefulTimeout ? Number.parseInt(process.env.SERVER_SHUTDOWN_TIMEOUT || "") || 5 : config.gracefulTimeout;
	let isClosing = false;
	let isClosed = false;
	const w = server.options.silent ? () => {} : process.stderr.write.bind(process.stderr);
	const forceClose = async () => {
		if (isClosed) return;
		w(red("\x1B[2K\rForcibly closing connections...\n"));
		isClosed = true;
		await server.close(true);
	};
	const shutdown = async () => {
		if (isClosing || isClosed) return;
		setTimeout(() => {
			globalThis.process.once("SIGINT", forceClose);
		}, 100);
		isClosing = true;
		const closePromise = server.close();
		for (let remaining = gracefulTimeout; remaining > 0; remaining--) {
			w(gray(`\rStopping server gracefully (${remaining}s)... Press ${bold("Ctrl+C")} again to force close.`));
			if (await Promise.race([closePromise.then(() => true), new Promise((r) => setTimeout(() => r(false), 1e3))])) {
				w("\x1B[2K\r" + green("Server closed successfully.\n"));
				isClosed = true;
				return;
			}
		}
		w("\x1B[2K\rGraceful shutdown timed out.\n");
		await forceClose();
	};
	for (const sig of ["SIGINT", "SIGTERM"]) globalThis.process.on(sig, shutdown);
};
//#endregion
//#region ../../node_modules/.bun/srvx@1.0.3/node_modules/srvx/dist/_chunks/_trust-proxy.mjs
function isTrustedProxy(trustProxy, remoteAddress) {
	if (trustProxy === void 0 || trustProxy === false) return false;
	if (trustProxy === true) return true;
	if (trustProxy === "loopback") return isLoopbackAddress(remoteAddress);
	if (remoteAddress === void 0) return false;
	if (trustProxy.includes(remoteAddress)) return true;
	const mapped = ipv4FromMapped(remoteAddress);
	return mapped !== void 0 && trustProxy.includes(mapped);
}
function ipv4FromMapped(address) {
	return address.startsWith("::ffff:") && address.includes(".") ? address.slice(7) : void 0;
}
function isLoopbackAddress(address) {
	return !!address && (address === "::1" || address.startsWith("127.") || address.startsWith("::ffff:127."));
}
var HOST_RE = /^(\[(?:[A-Fa-f0-9:.]+)\]|(?:[A-Za-z0-9_-]+\.)*[A-Za-z0-9_-]+|(?:\d{1,3}\.){3}\d{1,3})(:\d{1,5})?$/;
function forwardedList(value) {
	if (!value) return [];
	const raw = Array.isArray(value) ? value.join(",") : value;
	const out = [];
	for (const part of raw.split(",")) {
		const entry = part.trim();
		if (entry) out.push(entry);
	}
	return out;
}
function resolveClientIP(trustProxy, peer, forwardedFor) {
	if (!isTrustedProxy(trustProxy, peer)) return peer;
	const list = forwardedList(forwardedFor);
	for (let i = list.length - 1; i >= 0; i--) if (!isTrustedProxy(trustProxy, list[i])) return list[i];
	return list.length > 0 ? list[0] : peer;
}
function trustedHops(trustProxy, peer, forwardedFor) {
	if (!isTrustedProxy(trustProxy, peer)) return 0;
	const list = forwardedList(forwardedFor);
	let hops = 1;
	for (let i = list.length - 1; i >= 0; i--) {
		if (!isTrustedProxy(trustProxy, list[i])) return hops;
		hops++;
	}
	return Number.POSITIVE_INFINITY;
}
function forwardedHopValue(value, hops) {
	if (hops <= 0) return;
	const list = forwardedList(value);
	if (list.length === 0) return;
	return list[Math.max(0, list.length - hops)];
}
//#endregion
//#region ../../node_modules/.bun/srvx@1.0.3/node_modules/srvx/dist/adapters/node.mjs
function sendNodeResponseDetached(nodeRes, webRes, silent) {
	try {
		return _sendNodeResponse(nodeRes, webRes, true);
	} catch (error) {
		handleSendError(nodeRes, error, silent);
	}
}
function handleSendError(nodeRes, error, silent) {
	if (!silent) console.error("[srvx] Failed to send response:", error);
	failResponse(nodeRes);
}
function sendErrorResponse(nodeRes, error, silent) {
	if (!silent) console.error("[srvx] Unhandled error in fetch handler:", error);
	failResponse(nodeRes);
}
function failResponse(nodeRes) {
	if (nodeRes.writableEnded) return;
	if (nodeRes.headersSent) nodeRes.destroy();
	else {
		nodeRes.statusCode = 500;
		if (nodeRes.req?.httpVersion !== "2.0") nodeRes.statusMessage = "";
		nodeRes.end();
	}
}
function _sendNodeResponse(nodeRes, webRes, detached) {
	if (!webRes) {
		nodeRes.statusCode = 500;
		return endNodeResponse(nodeRes, detached);
	}
	if (webRes._toNodeResponse) {
		const res = webRes._toNodeResponse();
		if (res.body) {
			if (res.body instanceof ReadableStream) {
				writeHead(nodeRes, res.status, res.statusText, res.headers);
				return streamBody(res.body, nodeRes);
			} else if (typeof res.body?.pipe === "function") return pipeBody(res.body, nodeRes, res.status, res.statusText, res.headers);
			writeHead(nodeRes, res.status, res.statusText, res.headers);
			nodeRes.write(res.body);
		} else writeHead(nodeRes, res.status, res.statusText, res.headers);
		return endNodeResponse(nodeRes, detached);
	}
	const rawHeaders = [];
	for (const [key, value] of webRes.headers) rawHeaders.push(key, value);
	writeHead(nodeRes, webRes.status, webRes.statusText, rawHeaders);
	return webRes.body ? streamBody(webRes.body, nodeRes) : endNodeResponse(nodeRes, detached);
}
function writeHead(nodeRes, status, statusText, rawHeaders) {
	if (!nodeRes.headersSent) {
		if (nodeRes.req?.httpVersion === "2.0") nodeRes.writeHead(status, rawHeaders);
		else nodeRes.writeHead(status, safeStatusText(statusText), rawHeaders);
	}
}
var INVALID_REASON_PHRASE_RE = /[^\t\u0020-\u007E\u0080-\u00FF]/g;
function safeStatusText(statusText) {
	return typeof statusText === "string" && statusText ? statusText.replace(INVALID_REASON_PHRASE_RE, "") : statusText;
}
function endNodeResponse(nodeRes, detached) {
	if (detached) {
		nodeRes.end();
		return;
	}
	return new Promise((resolve) => nodeRes.end(resolve));
}
function pipeBody(stream, nodeRes, status, statusText, headers) {
	if (nodeRes.destroyed) {
		stream.destroy?.();
		return;
	}
	if (nodeRes.req?.method === "HEAD") {
		if (typeof stream.destroy === "function") stream.destroy();
		else stream.abort?.();
		writeHead(nodeRes, status, statusText, headers);
		return endNodeResponse(nodeRes);
	}
	if (typeof stream.on !== "function" || typeof stream.destroy !== "function") {
		writeHead(nodeRes, status, statusText, headers);
		stream.pipe(nodeRes);
		return new Promise((resolve) => nodeRes.on("close", resolve));
	}
	if (stream.destroyed) {
		writeHead(nodeRes, 500, "Internal Server Error", []);
		return endNodeResponse(nodeRes);
	}
	return new Promise((resolve) => {
		function cleanup() {
			stream.off("error", onEarlyError);
			stream.off("readable", onReadable);
			nodeRes.off("close", onResClose);
		}
		function onEarlyError() {
			cleanup();
			stream.destroy();
			writeHead(nodeRes, 500, "Internal Server Error", []);
			endNodeResponse(nodeRes).then(resolve);
		}
		function onReadable() {
			cleanup();
			if (nodeRes.destroyed) {
				stream.destroy();
				return resolve();
			}
			writeHead(nodeRes, status, statusText, headers);
			pipeline(stream, nodeRes).catch(() => {}).then(() => resolve());
		}
		function onResClose() {
			cleanup();
			stream.destroy();
			resolve();
		}
		stream.once("error", onEarlyError);
		stream.once("readable", onReadable);
		nodeRes.once("close", onResClose);
	});
}
function streamBody(stream, nodeRes) {
	if (nodeRes.destroyed) {
		stream.cancel().catch(() => {});
		return;
	}
	if (nodeRes.req?.method === "HEAD") {
		stream.cancel().catch(() => {});
		return endNodeResponse(nodeRes);
	}
	const reader = stream.getReader();
	function streamCancel(error) {
		reader.cancel(error).catch(() => {});
		if (error) nodeRes.destroy(error);
	}
	function streamHandle({ done, value }) {
		try {
			if (done) nodeRes.end();
			else if (nodeRes.write(value)) reader.read().then(streamHandle, streamCancel);
			else nodeRes.once("drain", () => reader.read().then(streamHandle, streamCancel));
		} catch (error) {
			streamCancel(error instanceof Error ? error : void 0);
		}
	}
	nodeRes.on("close", streamCancel);
	nodeRes.on("error", streamCancel);
	reader.read().then(streamHandle, streamCancel);
	return reader.closed.catch(streamCancel).finally(() => {
		nodeRes.off("close", streamCancel);
		nodeRes.off("error", streamCancel);
	});
}
var NodeRequestURL = class extends FastURL {
	constructor({ req, hops = 0 }) {
		const path = req.url || "/";
		const trusted = hops > 0;
		const forwardedHost = forwardedHopValue(req.headers["x-forwarded-host"], hops);
		let host = (forwardedHost && HOST_RE.test(forwardedHost) ? forwardedHost : void 0) || req.headers.host || req.headers[":authority"];
		if (host && !HOST_RE.test(host)) host = "_invalid_";
		else if (!host) {
			if (req.socket) host = `${req.socket.localFamily === "IPv6" ? "[" + req.socket.localAddress + "]" : req.socket.localAddress}:${req.socket?.localPort || "80"}`;
			else host = "localhost";
		}
		const forwardedProto = forwardedHopValue(req.headers["x-forwarded-proto"], hops);
		const protocol = req.socket?.encrypted || forwardedProto === "https" || trusted && req.headers[":scheme"] === "https" ? "https:" : "http:";
		if (path[0] === "/") {
			const qIndex = path.indexOf("?");
			super({
				protocol,
				host,
				pathname: qIndex === -1 ? path : path.slice(0, qIndex) || "/",
				search: qIndex === -1 ? "" : path.slice(qIndex) || ""
			});
		} else if (path === "*") super({
			protocol,
			host,
			pathname: "/*",
			search: ""
		});
		else {
			const target = URL.canParse(path) ? new URL(path) : void 0;
			if (target) {
				const targetHost = target.host;
				const targetPath = target.pathname;
				super({
					protocol,
					host: targetHost ? HOST_RE.test(targetHost) ? targetHost : "_invalid_" : host,
					pathname: targetPath ? targetPath[0] === "/" ? targetPath : `/${targetPath}` : "/",
					search: target.search
				});
			} else super({
				protocol,
				host,
				pathname: "/",
				search: ""
			});
		}
	}
};
function isValidAbsoluteForm(target) {
	if (!URL.canParse(target)) return false;
	const url = new URL(target);
	return (url.protocol === "http:" || url.protocol === "https:") && url.host !== "";
}
var _nonJoinedHeaders = /* @__PURE__ */ new Set([
	"age",
	"authorization",
	"content-length",
	"content-type",
	"etag",
	"expires",
	"from",
	"host",
	"if-modified-since",
	"if-unmodified-since",
	"last-modified",
	"location",
	"max-forwards",
	"proxy-authorization",
	"referer",
	"retry-after",
	"server",
	"user-agent"
]);
var _validHeaderNameRE = /^[!#$%&'*+\-.^_`|~\dA-Za-z]+$/;
function _isRepeated(rawHeaders, lowerName) {
	let seen = false;
	for (let i = 0; i < rawHeaders.length; i += 2) {
		const key = rawHeaders[i];
		if (key.length === lowerName.length && key.toLowerCase() === lowerName) {
			if (seen) return true;
			seen = true;
		}
	}
	return false;
}
var NodeRequestHeaders = /* @__PURE__ */ (() => {
	const NativeHeaders = globalThis.Headers;
	class Headers {
		#req;
		#headers;
		constructor(req) {
			this.#req = req;
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeHeaders;
		}
		_adopt(headers) {
			this.#headers = headers;
		}
		get _headers() {
			if (!this.#headers) {
				const headers = new NativeHeaders();
				const rawHeaders = this.#req.rawHeaders;
				const len = rawHeaders.length;
				for (let i = 0; i < len; i += 2) {
					const key = rawHeaders[i];
					if (key.charCodeAt(0) === 58) continue;
					const value = rawHeaders[i + 1];
					headers.append(key, value);
				}
				this.#headers = headers;
			}
			return this.#headers;
		}
		get(name) {
			if (this.#headers) return this.#headers.get(name);
			const lower = name.toLowerCase();
			if (lower.charCodeAt(0) === 58) return this._headers.get(name);
			const value = this.#req.headers[lower];
			if (typeof value === "string") return _nonJoinedHeaders.has(lower) && _isRepeated(this.#req.rawHeaders, lower) ? this._headers.get(name) : value;
			if (Array.isArray(value)) return value.join(", ");
			return lower !== "__proto__" && _validHeaderNameRE.test(name) ? null : this._headers.get(name);
		}
		has(name) {
			if (this.#headers) return this.#headers.has(name);
			const lower = name.toLowerCase();
			if (lower.charCodeAt(0) === 58) return this._headers.has(name);
			if (Object.hasOwn(this.#req.headers, lower)) return true;
			return lower !== "__proto__" && _validHeaderNameRE.test(name) ? false : this._headers.has(name);
		}
		getSetCookie() {
			if (this.#headers) return this.#headers.getSetCookie();
			const value = this.#req.headers["set-cookie"];
			return Array.isArray(value) ? value.slice() : value ? [value] : [];
		}
		entries() {
			return this._headers.entries();
		}
		[Symbol.iterator]() {
			return this.entries();
		}
	}
	lazyInherit(Headers.prototype, NativeHeaders.prototype, "_headers");
	Object.setPrototypeOf(Headers, NativeHeaders);
	Object.setPrototypeOf(Headers.prototype, NativeHeaders.prototype);
	return Headers;
})();
var kNativeRequest = /* @__PURE__ */ Symbol.for("srvx.nativeRequest");
function bodyUnusable() {
	return /* @__PURE__ */ new TypeError("Body is unusable: Body has already been read");
}
function abortError() {
	return new DOMException("The request was aborted.", "AbortError");
}
function erroredStream(error) {
	return new ReadableStream({ start(controller) {
		controller.error(error);
	} });
}
function isClientGone(req) {
	return req.aborted || !!req.errored || req.destroyed && !req.complete;
}
function isBodySourceFinished(req) {
	return isClientGone(req) || req.destroyed || req.readableEnded;
}
var NodeRequest = /* @__PURE__ */ (() => {
	const NativeRequest = getNativeRequest();
	class Request {
		runtime;
		waitUntil;
		#req;
		#url;
		#bodyStream;
		#bodyUsed = false;
		#request;
		#headers;
		#abortController;
		#maxRequestBodySize;
		#trustProxy;
		#ip;
		#ipResolved = false;
		#remoteAddress;
		#remoteResolved = false;
		#hops;
		constructor(ctx) {
			this.#req = ctx.req;
			this.#maxRequestBodySize = ctx.maxRequestBodySize;
			this.#trustProxy = ctx.trustProxy;
			this.runtime = {
				name: "node",
				node: ctx
			};
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeRequest;
		}
		#remoteAddr() {
			if (!this.#remoteResolved) {
				this.#remoteResolved = true;
				this.#remoteAddress = this.#req.socket?.remoteAddress;
			}
			return this.#remoteAddress;
		}
		#resolveHops() {
			if (this.#hops === void 0) this.#hops = trustedHops(this.#trustProxy, this.#remoteAddr(), this.#req.headers["x-forwarded-for"]);
			return this.#hops;
		}
		get ip() {
			if (this.#ipResolved) return this.#ip;
			this.#ipResolved = true;
			return this.#ip = resolveClientIP(this.#trustProxy, this.#remoteAddr(), this.#req.headers["x-forwarded-for"]);
		}
		get method() {
			if (this.#request) return this.#request.method;
			return this.#req.method || "GET";
		}
		get _url() {
			return this.#url ||= new NodeRequestURL({
				req: this.#req,
				hops: this.#resolveHops()
			});
		}
		set _url(url) {
			this.#url = url;
		}
		get url() {
			if (this.#request) return this.#request.url;
			return this._url.href;
		}
		get headers() {
			return this.#headers ||= new NodeRequestHeaders(this.#req);
		}
		get _abortController() {
			if (!this.#abortController) {
				this.#abortController = new AbortController();
				const { req, res } = this.runtime.node;
				const abortController = this.#abortController;
				const abort = (err) => abortController.abort?.(err);
				if (res) {
					const onClose = () => {
						const reqError = req.errored;
						if (reqError) abort(reqError);
						else if (!res.writableEnded) abort();
					};
					res.once("close", onClose);
					if (res.destroyed || isClientGone(req)) onClose();
				} else {
					const onClose = () => {
						if (!req.complete || req.aborted) abort();
					};
					req.once("close", onClose);
					if (isClientGone(req)) onClose();
				}
			}
			return this.#abortController;
		}
		get signal() {
			return this.#request ? this.#request.signal : this._abortController.signal;
		}
		#hasBody() {
			const method = this.method;
			return method !== "GET" && method !== "HEAD";
		}
		get body() {
			if (this.#request) return this.#request.body;
			if (this.#bodyStream === void 0) {
				let stream = null;
				if (this.#hasBody() && !this.#bodyUsed) {
					if (isBodySourceFinished(this.#req)) stream = erroredStream(this.#bodyError());
					else stream = Readable.toWeb(this.#req);
				}
				if (stream && this.#maxRequestBodySize !== void 0) stream = limitBodyStream(stream, this.#maxRequestBodySize);
				this.#bodyStream = stream;
			}
			return this.#bodyStream;
		}
		get bodyUsed() {
			if (this.#isBodyUsed()) return true;
			return this.#request ? this.#request.bodyUsed : false;
		}
		#isBodyUsed() {
			if (!this.#bodyUsed && this.#bodyStream && Readable.isDisturbed(this.#bodyStream)) this.#bodyUsed = true;
			return this.#bodyUsed;
		}
		#bodyError() {
			const signal = this._abortController.signal;
			if (signal.aborted) return signal.reason;
			return this.#req.errored || (isClientGone(this.#req) ? abortError() : bodyUnusable());
		}
		#readBuffered() {
			if ("rawBody" in this.#req && Buffer.isBuffer(this.#req.rawBody)) return readBody(this.#req, this.#maxRequestBodySize);
			if (isBodySourceFinished(this.#req)) return Promise.reject(this.#bodyError());
			return readBody(this.#req, this.#maxRequestBodySize);
		}
		text() {
			if (this.#isBodyUsed()) return Promise.reject(bodyUnusable());
			if (this.#request) return this.#request.text();
			if (!this.#hasBody()) return Promise.resolve("");
			this.#bodyUsed = true;
			if (this.#bodyStream !== void 0) try {
				return new Response(this.#bodyStream).text();
			} catch (error) {
				return Promise.reject(error);
			}
			return this.#readBuffered().then((buf) => buf.toString());
		}
		json() {
			if (this.#isBodyUsed()) return Promise.reject(bodyUnusable());
			if (this.#request) return this.#request.json();
			if (!this.#hasBody()) return Promise.resolve().then(() => JSON.parse(""));
			this.#bodyUsed = true;
			if (this.#bodyStream !== void 0) try {
				return new Response(this.#bodyStream).json();
			} catch (error) {
				return Promise.reject(error);
			}
			return this.#readBuffered().then((buf) => JSON.parse(buf.toString()));
		}
		arrayBuffer() {
			return this.#consumeNative("arrayBuffer");
		}
		bytes() {
			return this.#consumeNative("bytes");
		}
		blob() {
			return this.#consumeNative("blob");
		}
		formData() {
			return this.#consumeNative("formData");
		}
		#consumeNative(method) {
			if (this.#isBodyUsed()) return Promise.reject(bodyUnusable());
			try {
				return this._request[method]();
			} catch (error) {
				return Promise.reject(error);
			}
		}
		get _request() {
			if (!this.#request) {
				const body = this.#isBodyUsed() ? null : this.body;
				this.#request = new NativeRequest(this.url, {
					method: this.method,
					headers: this.headers,
					signal: this._abortController.signal,
					body,
					duplex: body ? "half" : void 0
				});
				this.#headers._adopt(this.#request.headers);
				this.#bodyStream = void 0;
			}
			return this.#request;
		}
	}
	lazyInherit(Request.prototype, NativeRequest.prototype, "_request");
	Object.setPrototypeOf(Request.prototype, NativeRequest.prototype);
	return Request;
})();
function readBody(req, maxRequestBodySize) {
	if ("rawBody" in req && Buffer.isBuffer(req.rawBody)) {
		if (maxRequestBodySize !== void 0 && req.rawBody.length > maxRequestBodySize) return Promise.reject(createBodyTooLargeError(maxRequestBodySize));
		return Promise.resolve(req.rawBody);
	}
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		const cleanup = () => {
			req.off("data", onData);
			req.off("end", onEnd);
			req.off("error", onError);
			req.off("close", onClose);
		};
		const onData = (chunk) => {
			if (maxRequestBodySize !== void 0) {
				size += chunk.length;
				if (size > maxRequestBodySize) {
					cleanup();
					req.pause?.();
					reject(createBodyTooLargeError(maxRequestBodySize));
					return;
				}
			}
			chunks.push(chunk);
		};
		const onError = (err) => {
			cleanup();
			reject(err);
		};
		const onEnd = () => {
			cleanup();
			if (isClientGone(req)) {
				reject(req.errored || abortError());
				return;
			}
			resolve(chunks.length === 1 ? chunks[0] : Buffer.concat(chunks));
		};
		const onClose = () => {
			cleanup();
			reject(req.errored || abortError());
		};
		req.on("data", onData).once("end", onEnd).once("error", onError).once("close", onClose);
	});
}
function getNativeRequest() {
	let R = globalThis[kNativeRequest] || globalThis.Request;
	while (R?._srvx) R = Object.getPrototypeOf(R);
	return globalThis[kNativeRequest] ??= R;
}
var NodeResponse = /* @__PURE__ */ (() => {
	const NativeResponse = globalThis.Response;
	class NodeResponse {
		#body;
		#init;
		#headers;
		#response;
		constructor(body, init) {
			this.#body = body;
			this.#init = init;
		}
		static [Symbol.hasInstance](val) {
			return val instanceof NativeResponse;
		}
		static json(data, init) {
			const body = JSON.stringify(data);
			if (body === void 0) throw new TypeError("Value is not JSON serializable");
			let headers = init?.headers;
			if (!headers) headers = { "content-type": "application/json" };
			else {
				const merged = new Headers(headers);
				if (!merged.has("content-type")) merged.set("content-type", "application/json");
				headers = merged;
			}
			return new NodeResponse(body, init ? {
				...init,
				headers
			} : { headers });
		}
		get status() {
			return this.#response?.status || this.#init?.status || 200;
		}
		get statusText() {
			return this.#response?.statusText || this.#init?.statusText || "";
		}
		get headers() {
			if (this.#response) return this.#response.headers;
			if (this.#headers) return this.#headers;
			return this.#headers = new Headers(this.#init?.headers);
		}
		get ok() {
			if (this.#response) return this.#response.ok;
			const status = this.status;
			return status >= 200 && status < 300;
		}
		get _response() {
			if (this.#response) return this.#response;
			let body = this.#body;
			if (body && typeof body.pipe === "function" && !(body instanceof Readable)) {
				const stream = new PassThrough();
				body.pipe(stream);
				const abort = body.abort;
				if (abort) stream.once("close", () => abort());
				body = stream;
			}
			this.#response = new NativeResponse(body, this.#headers ? {
				...this.#init,
				headers: this.#headers
			} : this.#init);
			this.#init = void 0;
			this.#headers = void 0;
			this.#body = void 0;
			return this.#response;
		}
		_toNodeResponse() {
			const status = this.status;
			const statusText = this.statusText;
			let body;
			let contentType;
			let contentLength;
			if (this.#response) body = this.#response.body;
			else if (this.#body != null) {
				if (this.#body instanceof ReadableStream) body = this.#body;
				else if (typeof this.#body === "string") {
					body = this.#body;
					contentType = "text/plain; charset=UTF-8";
					contentLength = Buffer.byteLength(this.#body);
				} else if (this.#body instanceof ArrayBuffer) {
					body = Buffer.from(this.#body);
					contentLength = this.#body.byteLength;
				} else if (this.#body instanceof Uint8Array) {
					body = this.#body;
					contentLength = this.#body.byteLength;
				} else if (this.#body instanceof DataView) {
					body = Buffer.from(this.#body.buffer, this.#body.byteOffset, this.#body.byteLength);
					contentLength = this.#body.byteLength;
				} else if (this.#body instanceof Blob) {
					body = this.#body.stream();
					contentType = this.#body.type;
					contentLength = this.#body.size;
				} else if (typeof this.#body.pipe === "function") body = this.#body;
				else body = this._response.body;
			}
			const headers = [];
			const initHeaders = this.#init?.headers;
			const headerEntries = this.#response?.headers || this.#headers || (initHeaders ? Array.isArray(initHeaders) ? initHeaders : initHeaders?.entries ? initHeaders.entries() : Object.entries(initHeaders) : void 0);
			let hasContentTypeHeader;
			let hasContentLength;
			if (headerEntries) for (const [key, value] of headerEntries) {
				const lowerKey = typeof key === "string" ? key.toLowerCase() : String(key);
				if (Array.isArray(value)) for (const v of value) headers.push(lowerKey, v);
				else headers.push(lowerKey, value);
				if (lowerKey === "content-type") hasContentTypeHeader = true;
				else if (lowerKey === "content-length") hasContentLength = true;
			}
			if (contentType && !hasContentTypeHeader) headers.push("content-type", contentType);
			if (contentLength != null && !hasContentLength) headers.push("content-length", String(contentLength));
			this.#init = void 0;
			this.#headers = void 0;
			this.#response = void 0;
			this.#body = void 0;
			return {
				status,
				statusText,
				headers,
				body
			};
		}
	}
	lazyInherit(NodeResponse.prototype, NativeResponse.prototype, "_response");
	Object.setPrototypeOf(NodeResponse, NativeResponse);
	Object.setPrototypeOf(NodeResponse.prototype, NativeResponse.prototype);
	return NodeResponse;
})();
function serve(options) {
	return new NodeServer(options);
}
var NodeServer = class {
	runtime = "node";
	options;
	node;
	serveOptions;
	fetch;
	waitUntil;
	#isSecure;
	#listeningPromise;
	#listenError;
	#listenErrorObserved;
	#wait;
	constructor(options) {
		this.options = {
			...options,
			middleware: [...options.middleware || []]
		};
		for (const plugin of options.plugins || []) plugin(this);
		errorPlugin(this);
		const fetchHandler = this.fetch = wrapFetch(this);
		const handler = (nodeReq, nodeRes) => {
			const reqUrl = nodeReq.url;
			if (reqUrl && reqUrl[0] !== "/" && reqUrl !== "*" && !isValidAbsoluteForm(reqUrl)) {
				nodeRes.statusCode = 400;
				nodeRes.end();
				return;
			}
			const request = new NodeRequest({
				req: nodeReq,
				res: nodeRes,
				maxRequestBodySize: this.options.maxRequestBodySize,
				trustProxy: this.options.trustProxy
			});
			request.waitUntil = this.#wait?.waitUntil;
			let res;
			try {
				res = fetchHandler(request);
			} catch (error) {
				return sendErrorResponse(nodeRes, error, this.options.silent);
			}
			return res instanceof Promise ? res.then((resolvedRes) => sendNodeResponseDetached(nodeRes, resolvedRes, this.options.silent), (error) => sendErrorResponse(nodeRes, error, this.options.silent)) : sendNodeResponseDetached(nodeRes, res, this.options.silent);
		};
		this.node = {
			handler,
			server: void 0
		};
		const loader = globalThis.__srvxLoader__;
		if (loader) {
			loader({ server: this });
			return;
		}
		gracefulShutdownPlugin(this);
		this.#wait = createWaitUntil();
		this.waitUntil = this.#wait.waitUntil;
		const tls = resolveTLSOptions(this.options);
		const { port, hostname: host } = resolvePortAndHost(this.options);
		this.serveOptions = {
			port,
			host,
			exclusive: !this.options.reusePort,
			reusePort: this.options.reusePort,
			...tls,
			...this.options.node
		};
		let server;
		this.#isSecure = !!this.serveOptions.cert && this.options.protocol !== "http";
		if (this.options.node?.http2 ?? this.#isSecure) {
			if (this.#isSecure) server = nodeHTTP2.createSecureServer({
				allowHTTP1: true,
				...this.serveOptions
			}, handler);
			else throw new Error("node.http2 option requires tls certificate!");
		} else if (this.#isSecure) server = nodeHTTPS.createServer(this.serveOptions, handler);
		else server = nodeHTTP.createServer(this.serveOptions, handler);
		this.node.server = server;
		if (!options.manual) this.serve().catch((error) => this.#reportUnobservedListenError(error));
	}
	#reportUnobservedListenError(error) {
		if (this.#listenErrorObserved) return;
		if (!this.options.silent) console.error("[srvx] Failed to start server:", error);
		const process = globalThis.process;
		if (process && !process.exitCode) process.exitCode = 1;
	}
	serve() {
		if (this.#listeningPromise) return this.#listeningPromise.then(() => this);
		const server = this.node?.server;
		if (!server) return Promise.reject(/* @__PURE__ */ new Error("Server not initialized"));
		this.#listenError = void 0;
		this.#listeningPromise = new Promise((resolve, reject) => {
			const onError = (error) => {
				server.off("listening", onListening);
				this.#listenError = error;
				this.#listeningPromise = void 0;
				reject(error);
			};
			const onListening = () => {
				server.off("error", onError);
				printListening(this.options, this.url);
				resolve();
			};
			server.once("error", onError);
			server.once("listening", onListening);
			server.listen(this.serveOptions);
		});
		return this.#listeningPromise.then(() => this);
	}
	get url() {
		const addr = this.node?.server?.address();
		if (!addr) return;
		return typeof addr === "string" ? addr : fmtURL(addr.address, addr.port, this.#isSecure);
	}
	ready() {
		this.#listenErrorObserved = true;
		if (this.#listenError) return Promise.reject(this.#listenError);
		return Promise.resolve(this.#listeningPromise).then(() => this);
	}
	async close(closeAll) {
		await Promise.all([this.#wait?.wait(), new Promise((resolve, reject) => {
			const server = this.node?.server;
			if (server && closeAll && "closeAllConnections" in server) server.closeAllConnections();
			if (!server || !server.listening) return resolve();
			server.close((error) => error ? reject(error) : resolve());
		})]);
	}
};
//#endregion
//#region ../../node_modules/.bun/rou3@0.9.2/node_modules/rou3/dist/index.mjs
var NullProtoObj = /* @__PURE__ */ (() => {
	const e = function() {};
	return e.prototype = Object.create(null), Object.freeze(e.prototype), e;
})();
//#endregion
//#region ../../node_modules/.bun/h3@2.0.1-rc.31+d505b50645ee7469/node_modules/h3/dist/response.mjs
var NEEDLESS_ESCAPE_SRC = String.raw`%(?:2[146-9A-E]|3[0-9ABD]|4[0-9A-F]|5[0-9ABDF]|6[1-9A-F]|7[0-9ACE])`;
var NEEDLESS_ESCAPE_RE = /* @__PURE__ */ new RegExp(NEEDLESS_ESCAPE_SRC, "i");
var NEEDLESS_ESCAPE_RE_G = /* @__PURE__ */ new RegExp(NEEDLESS_ESCAPE_SRC, "gi");
function isNonCanonicalPathname(pathname) {
	return NEEDLESS_ESCAPE_RE.test(pathname);
}
function canonicalPathname(pathname) {
	return pathname.replace(NEEDLESS_ESCAPE_RE_G, (m) => String.fromCharCode(Number.parseInt(m.slice(1), 16)));
}
function decodePathname(pathname) {
	try {
		return decodeURI(pathname);
	} catch {
		return;
	}
}
var ENCODED_SEP_RE_G$1 = /%(?:25)*(?:2f|5c)/gi;
var ENCODED_SEP_FLAT_RE_G = /%(?:2f|5c)/gi;
function decodePreservingSeparators(value, opts) {
	if (!value.includes("%")) return value;
	const decode = opts?.decode || decodeURIComponent;
	const re = opts?.nested === false ? ENCODED_SEP_FLAT_RE_G : ENCODED_SEP_RE_G$1;
	let result = "";
	let lastIndex = 0;
	re.lastIndex = 0;
	for (let m; m = re.exec(value);) {
		result += decode(value.slice(lastIndex, m.index)) + m[0];
		lastIndex = m.index + m[0].length;
	}
	return result + decode(value.slice(lastIndex));
}
var kEventNS = "h3.internal.event.";
var kEventRes = /* @__PURE__ */ Symbol.for(`${kEventNS}res`);
var kEventResHeaders = /* @__PURE__ */ Symbol.for(`${kEventNS}res.headers`);
var kEventResErrHeaders = /* @__PURE__ */ Symbol.for(`${kEventNS}res.err.headers`);
var kMalformedURL = /* @__PURE__ */ Symbol.for(`${kEventNS}malformed`);
var H3Event = class {
	app;
	req;
	url;
	context;
	static __is_event__ = true;
	constructor(req, context, app) {
		this.context = req.context = context || req.context || new NullProtoObj();
		this.req = req;
		this.app = app;
		const _url = req._url;
		let url = _url && _url instanceof URL ? _url : new FastURL(req.url);
		const pathname = url.pathname;
		if (pathname.includes("%")) {
			if (decodePathname(pathname) === void 0) this[kMalformedURL] = true;
			else if (isNonCanonicalPathname(pathname)) url = new FastURL(`${url.protocol}//${url.host}${canonicalPathname(pathname)}${url.search}`);
		}
		this.url = url;
	}
	get res() {
		return this[kEventRes] ||= new H3EventResponse();
	}
	get runtime() {
		return this.req.runtime;
	}
	waitUntil(promise) {
		this.req.waitUntil?.(promise);
	}
	toString() {
		return `[${this.req.method}] ${this.req.url}`;
	}
	toJSON() {
		return this.toString();
	}
	get node() {
		return this.req.runtime?.node;
	}
	get headers() {
		return this.req.headers;
	}
	get path() {
		return this.url.pathname + this.url.search;
	}
	get method() {
		return this.req.method;
	}
};
var H3EventResponse = class {
	status;
	statusText;
	get headers() {
		return this[kEventResHeaders] ||= new Headers();
	}
	get errHeaders() {
		return this[kEventResErrHeaders] ||= new Headers();
	}
};
var DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
	return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
	if (!statusCode) return defaultStatusCode;
	if (typeof statusCode === "string") statusCode = +statusCode;
	if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) return defaultStatusCode;
	return statusCode;
}
var HTTPError = class HTTPError extends Error {
	get name() {
		return "HTTPError";
	}
	status;
	statusText;
	headers;
	cause;
	data;
	body;
	unhandled;
	static isError(input) {
		return input instanceof Error && input?.name === "HTTPError";
	}
	static status(status, statusText, details) {
		return new HTTPError({
			...details,
			statusText,
			status
		});
	}
	constructor(arg1, arg2) {
		let messageInput;
		let details;
		if (typeof arg1 === "string") {
			messageInput = arg1;
			details = arg2;
		} else details = arg1;
		const status = sanitizeStatusCode(details?.status || details?.statusCode || (details?.cause)?.status || (details?.cause)?.statusCode, 500);
		const statusText = sanitizeStatusMessage(details?.statusText || details?.statusMessage || (details?.cause)?.statusText || (details?.cause)?.statusMessage);
		const message = messageInput || details?.message || (details?.cause)?.message || details?.statusText || details?.statusMessage || [
			"HTTPError",
			status,
			statusText
		].filter(Boolean).join(" ");
		super(message, { cause: details });
		this.cause = details;
		this.status = status;
		this.statusText = statusText || void 0;
		const rawHeaders = details?.headers || (details?.cause)?.headers;
		this.headers = rawHeaders ? new Headers(rawHeaders) : void 0;
		this.unhandled = details?.unhandled ?? (details?.cause)?.unhandled ?? void 0;
		this.data = details?.data;
		this.body = details?.body;
	}
	get statusCode() {
		return this.status;
	}
	get statusMessage() {
		return this.statusText;
	}
	toJSON() {
		const unhandled = this.unhandled;
		return {
			status: this.status,
			statusText: this.statusText,
			unhandled,
			message: unhandled ? "HTTPError" : this.message,
			data: unhandled ? void 0 : this.data,
			...unhandled ? void 0 : this.body
		};
	}
};
function isJSONSerializable(value, _type) {
	if (value === null || value === void 0) return true;
	if (_type !== "object") return _type === "boolean" || _type === "number" || _type === "string";
	if (typeof value.toJSON === "function") return true;
	if (Array.isArray(value)) return true;
	if (typeof value.pipe === "function" || typeof value.pipeTo === "function") return false;
	if (value instanceof NullProtoObj) return true;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
var kEventDispose = /* @__PURE__ */ Symbol.for("h3.internal.event.dispose");
var kNotFound = /* @__PURE__ */ Symbol.for("h3.notFound");
var kHandled = /* @__PURE__ */ Symbol.for("h3.handled");
function toResponse(val, event, config = {}) {
	if (typeof val?.then === "function") return val.then((resolvedVal) => toResponse(resolvedVal, event, config), (r) => toResponse(toError(r), event, config));
	let response;
	try {
		response = prepareResponse(val, event, config);
	} catch (error) {
		return toResponse(toError(error), event, config);
	}
	if (typeof response?.then === "function") return toResponse(response, event, config);
	const { onResponse } = config;
	if (onResponse) return Promise.resolve().then(() => onResponse(response, event)).catch((error) => {
		if (!config.silent) console.error(error);
	}).then(() => event[kEventDispose]?.observe(response, val) ?? response);
	return event[kEventDispose]?.observe(response, val) ?? response;
}
function toError(value) {
	if (value === kNotFound || value === kHandled || value instanceof Error) return value;
	if (typeof value === "number") return new HTTPError({ status: value });
	const error = new HTTPError({
		status: 500,
		unhandled: true
	});
	error.cause = value;
	return error;
}
var kHTTPResponse = /* @__PURE__ */ Symbol.for("h3.HTTPResponse");
var HTTPResponse = class {
	#headers;
	#init;
	body;
	constructor(body, init) {
		this.body = body;
		this.#init = init;
	}
	get status() {
		return this.#init?.status;
	}
	get statusText() {
		return this.#init?.statusText;
	}
	get headers() {
		return this.#headers ||= new Headers(this.#init?.headers);
	}
};
HTTPResponse.prototype[kHTTPResponse] = true;
function prepareResponse(val, event, config, nested) {
	if (val === kHandled) return new NodeResponse(null);
	if (val === kNotFound) val = new HTTPError({
		status: 404,
		message: `Cannot find any route matching [${event.req.method}] ${event.url}`
	});
	if (val && val instanceof Error) {
		const isHTTPError = HTTPError.isError(val);
		const error = isHTTPError ? val : new HTTPError(val);
		if (!isHTTPError) {
			error.unhandled = true;
			if (val?.stack) error.stack = val.stack;
		}
		if (error.unhandled && !config.silent) console.error(error);
		const { onError } = config;
		const errHeaders = event[kEventRes]?.[kEventResErrHeaders];
		if (onError && !nested) return Promise.resolve().then(() => onError(error, event)).catch(toError).then((newVal) => prepareResponse(newVal ?? val, event, config, true));
		event[kEventRes] = void 0;
		return errorResponse(error, config.debug, errHeaders);
	}
	const preparedRes = event[kEventRes];
	let preparedHeaders = preparedRes?.[kEventResHeaders];
	event[kEventRes] = void 0;
	if (!(val instanceof Response)) {
		const res = prepareResponseBody(val, event, config);
		const rawStatus = res.status || preparedRes?.status;
		const status = rawStatus ? sanitizeStatusCode(rawStatus) : void 0;
		const rawStatusText = res.statusText || preparedRes?.statusText;
		return new NodeResponse(nullBody(event.req.method, status) ? null : res.body, {
			status,
			statusText: rawStatusText === void 0 ? void 0 : sanitizeStatusMessage(rawStatusText),
			headers: res.headers && preparedHeaders ? mergeHeaders(res.headers, preparedHeaders) : res.headers || preparedHeaders
		});
	}
	if (val.status >= 400) preparedHeaders = preparedRes?.[kEventResErrHeaders];
	if (preparedHeaders && !nested && !preparedHeaders.keys().next().done) return new NodeResponse(nullBody(event.req.method, val.status) ? null : val.body, {
		status: val.status,
		statusText: val.statusText,
		headers: mergeHeaders(val.headers, preparedHeaders)
	});
	return event.req.method === "HEAD" && val.body !== null ? new NodeResponse(null, {
		status: val.status,
		statusText: val.statusText,
		headers: val.headers
	}) : val;
}
function mergeHeaders(base, overrides, target = new Headers(base)) {
	for (const [name, value] of overrides) if (name === "set-cookie") target.append(name, value);
	else target.set(name, value);
	return target;
}
var frozen = (name) => (...args) => {
	throw new Error(`Headers are frozen (${name} ${args.join(", ")})`);
};
var FrozenHeaders = class extends Headers {
	set = frozen("set");
	append = frozen("append");
	delete = frozen("delete");
};
var emptyHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-length": "0" });
var jsonHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-type": "application/json;charset=UTF-8" });
function prepareResponseBody(val, event, config) {
	if (val === null || val === void 0) return {
		body: "",
		headers: emptyHeaders
	};
	const valType = typeof val;
	if (valType === "string") return { body: val };
	if (val instanceof Uint8Array) return {
		body: val,
		headers: new Headers({ "content-length": val.byteLength.toString() })
	};
	if (val instanceof HTTPResponse || val?.[kHTTPResponse] === true) return val;
	if (isJSONSerializable(val, valType)) return {
		body: JSON.stringify(val, void 0, config.debug ? 2 : void 0),
		headers: jsonHeaders
	};
	if (valType === "bigint") return {
		body: val.toString(),
		headers: jsonHeaders
	};
	if (val instanceof Blob) {
		const headers = new Headers({
			"content-type": val.type,
			"content-length": val.size.toString()
		});
		let filename = val.name;
		if (filename) {
			filename = encodeURIComponent(filename);
			headers.set("content-disposition", `filename="${filename}"; filename*=UTF-8''${filename}`);
		}
		return {
			body: val.stream(),
			headers
		};
	}
	if (valType === "symbol") return { body: val.toString() };
	if (valType === "function") return { body: `${val.name}()` };
	return { body: val };
}
function nullBody(method, status) {
	return method === "HEAD" || status === 100 || status === 101 || status === 102 || status === 204 || status === 205 || status === 304;
}
function errorResponse(error, debug, errHeaders) {
	let headers = error.headers ? mergeHeaders(jsonHeaders, error.headers) : new Headers(jsonHeaders);
	if (errHeaders) headers = mergeHeaders(headers, errHeaders);
	return new NodeResponse(JSON.stringify({
		...error.toJSON(),
		stack: debug && error.stack ? error.stack.split("\n").map((l) => l.trim()) : void 0
	}, void 0, debug ? 2 : void 0), {
		status: error.status,
		statusText: error.statusText,
		headers
	});
}
//#endregion
//#region ../../node_modules/.bun/h3@2.0.1-rc.31+d505b50645ee7469/node_modules/h3/dist/middleware.mjs
function composeMiddleware(middleware) {
	let chain = (event, handler) => handler(event);
	for (let i = middleware.length - 1; i >= 0; i--) {
		const fn = middleware[i];
		const inner = chain;
		chain = (event, handler) => callLayer(fn, event, handler, inner);
	}
	return chain;
}
function composeHandler(middleware, handler) {
	const chain = composeMiddleware(middleware);
	return function _composedHandler(event) {
		return chain(event, handler);
	};
}
function callMiddleware(event, middleware, handler, index = 0) {
	return index === middleware.length ? handler(event) : callLayer(middleware[index], event, handler, (_event, _handler) => callMiddleware(_event, middleware, _handler, index + 1));
}
function callLayer(fn, event, handler, inner) {
	let nextCalled;
	let nextResult;
	const next = () => {
		if (nextCalled) return nextResult;
		nextCalled = true;
		nextResult = inner(event, handler);
		return nextResult;
	};
	const ret = fn(event, next);
	return isUnhandledResponse(ret) ? next() : typeof ret?.then === "function" ? ret.then((resolved) => isUnhandledResponse(resolved) ? next() : resolved) : ret;
}
function isUnhandledResponse(val) {
	return val === void 0 || val === kNotFound;
}
//#endregion
//#region ../../node_modules/.bun/h3@2.0.1-rc.31+d505b50645ee7469/node_modules/h3/dist/cache.mjs
function toRequest(input, options) {
	if (typeof input === "string") {
		let url = input;
		if (url[0] === "/") url = `http://${safeHost((options?.headers ? new Headers(options.headers) : void 0)?.get("host"))}${url}`;
		return new Request(url, options);
	} else if (options || input instanceof URL) return new Request(input, options);
	return input;
}
function safeHost(host) {
	return host && !/[/\\?#@\s]/.test(host) ? host : "localhost";
}
function defineHandler(input) {
	if (typeof input === "function") return handlerWithFetch(input);
	const handler = input.handler || (input.fetch ? function _fetchHandler(event) {
		return input.fetch(event.req);
	} : NoHandler);
	const composed = input.middleware?.length && composeHandler(input.middleware, handler);
	const eventHandler = handlerWithFetch(composed || handler);
	return Object.assign(eventHandler, input, composed && { fetch: eventHandler.fetch });
}
function handlerWithFetch(handler) {
	if ("fetch" in handler) return handler;
	return Object.assign(handler, { fetch: (req) => {
		if (typeof req === "string") req = new URL(req, "http://_");
		if (req instanceof URL) req = new Request(req);
		const event = new H3Event(req);
		try {
			return Promise.resolve(toResponse(handler(event), event));
		} catch (error) {
			return Promise.resolve(toResponse(toError(error), event));
		}
	} });
}
function defineLazyEventHandler(loader) {
	let handler;
	let promise;
	return defineHandler(function lazyHandler(event) {
		return handler ? handler(event) : (promise ??= Promise.resolve(loader()).then(function resolveLazyHandler(r) {
			handler = toEventHandler(r) || toEventHandler(r.default);
			if (typeof handler !== "function") throw new TypeError("Invalid lazy handler", { cause: { resolved: r } });
			return handler;
		})).then((r) => r(event));
	});
}
function toEventHandler(handler) {
	if (typeof handler === "function") return handler;
	if (typeof handler?.handler === "function" && handler.constructor?.["~h3"]) return handler.handler;
	if (typeof handler?.fetch === "function") return function _fetchHandler(event) {
		return handler.fetch(event.req);
	};
}
var NoHandler = () => kNotFound;
var H3Core = class {
	static "~h3" = true;
	config;
	"~middleware";
	"~routes" = [];
	"~dispatch";
	"~composed";
	constructor(config = {}) {
		this["~middleware"] = [];
		this.config = config;
		this.fetch = this.fetch.bind(this);
		this.handler = this.handler.bind(this);
	}
	fetch(request) {
		return this["~request"](request);
	}
	handler(event) {
		const route = this["~findRoute"](event);
		if (route) {
			event.context.params = route.params;
			event.context.matchedRoute = route.data;
		}
		return (this["~dispatch"] ??= createDispatcher(this))(event, route);
	}
	"~request"(request, context) {
		const event = new H3Event(request, context, this);
		let handlerRes;
		try {
			if (event[kMalformedURL] && !this.config.allowMalformedURL) throw new HTTPError({
				status: 400,
				message: "Bad Request"
			});
			if (this.config.onRequest) {
				const hookRes = this.config.onRequest(event);
				handlerRes = typeof hookRes?.then === "function" ? hookRes.then(() => this.handler(event)) : this.handler(event);
			} else handlerRes = this.handler(event);
		} catch (error) {
			handlerRes = Promise.reject(error);
		}
		return toResponse(handlerRes, event, this.config);
	}
	"~findRoute"(_event) {}
	"~addRoute"(_route) {
		this["~routes"].push(_route);
	}
	"~getMiddleware"(_event, _route) {
		return this["~middleware"];
	}
};
function createDispatcher(app) {
	if (app["~getMiddleware"] !== H3Core.prototype["~getMiddleware"]) return (event, route) => callMiddleware(event, app["~getMiddleware"](event, route || void 0), routeHandler(route));
	const middleware = app["~middleware"];
	if (middleware.length === 0) return (event, route) => routeHandler(route)(event);
	const composed = app["~composed"] ??= composeMiddleware(middleware);
	return (event, route) => composed(event, routeHandler(route));
}
function routeHandler(route) {
	const data = route?.data;
	if (!data) return NoHandler;
	return data.middleware?.length ? data["~composed"] ??= composeHandler(data.middleware, data.handler) : data.handler;
}
//#endregion
//#region ../../node_modules/.bun/h3@2.0.1-rc.31+d505b50645ee7469/node_modules/h3/dist/path.mjs
var DOT_SEGMENT_SRC = String.raw`(?:^|/)(?:\.|%(?:25)*2e){1,2}(?:/|$)`;
var ENCODED_SEP_SRC = String.raw`%(?:25)*(?:2f|5c)`;
var ENCODED_SEP_RE_G = /* @__PURE__ */ new RegExp(ENCODED_SEP_SRC, "gi");
var TRIGGER_RES = /* @__PURE__ */ (() => {
	const base = String.raw`\\|` + DOT_SEGMENT_SRC;
	return [
		new RegExp(base, "i"),
		new RegExp(`${base}|${ENCODED_SEP_SRC}`, "i"),
		new RegExp(`${base}|//`, "i"),
		new RegExp(`${base}|${ENCODED_SEP_SRC}|//`, "i")
	];
})();
var ENCODED_DOT_RE_G = /%(?:25)*2e/gi;
function resolveDotSegments(path, opts) {
	if (path[0] !== "/" || path[1] === "/" || path[1] === "\\") path = "/" + path.replace(/^[/\\]+/, "");
	if (isCanonicalPath(path, opts)) return path;
	const decodeSlashes = opts?.decodeSlashes;
	const mergeSlashes = opts?.mergeSlashes;
	let normalized = path.includes("\\") ? path.replaceAll("\\", "/") : path;
	if (decodeSlashes) normalized = normalized.replace(ENCODED_SEP_RE_G, "/");
	const segments = normalized.split("/");
	const lastIndex = segments.length - 1;
	const resolved = [];
	for (let i = 0; i <= lastIndex; i++) {
		const segment = segments[i];
		const normalizedSegment = segment.includes("%") ? segment.replace(ENCODED_DOT_RE_G, ".") : segment;
		const isDotSegment = normalizedSegment === "." || normalizedSegment === "..";
		if (normalizedSegment === "..") {
			if (resolved.length > 1) resolved.pop();
		} else if (mergeSlashes && normalizedSegment === "" && i > 0 && i < lastIndex) {} else if (!isDotSegment) resolved.push(segment);
		if (isDotSegment && i === lastIndex) resolved.push("");
	}
	return (resolved.join("/") || "/").replace(/^\/+/, "/");
}
function isCanonicalPath(path, opts) {
	return path[0] === "/" && path[1] !== "/" && path[1] !== "\\" && !TRIGGER_RES[(opts?.decodeSlashes ? 1 : 0) | (opts?.mergeSlashes ? 2 : 0)].test(path);
}
//#endregion
//#region ../../node_modules/.bun/h3@2.0.1-rc.31+d505b50645ee7469/node_modules/h3/dist/_utils.mjs
var CANONICAL_OPTS = { decodeSlashes: true };
var MERGED_OPTS = {
	decodeSlashes: true,
	mergeSlashes: true
};
function canonicalPath(pathname) {
	return resolveDotSegments(pathname, CANONICAL_OPTS);
}
function decodedPath(pathname) {
	let decoded = pathname;
	for (let pass = 0; hasDecodableEscape(decoded); pass++) {
		if (pass >= MAX_PASSES) return decoded;
		const input = pass < EXACT_PASSES ? decoded : flattenNesting(decoded);
		let next;
		try {
			next = decodePreservingSeparators(input);
		} catch {
			return input;
		}
		if (next === input) return input;
		decoded = next;
	}
	return decoded;
}
var EXACT_PASSES = 8;
var MAX_PASSES = 24;
var CHAR_2 = 50;
var CHAR_5 = 53;
function needsCanonicalPasses(pathname) {
	return !isCanonicalPath(pathname, MERGED_OPTS);
}
function mergedCanonicalPath(pathname, canonical) {
	const merged = resolveDotSegments(pathname, MERGED_OPTS);
	return merged === canonical ? void 0 : merged;
}
function hasDecodableEscape(value) {
	for (let i = value.indexOf("%"); i !== -1; i = value.indexOf("%", i + 1)) {
		const byte = escapeByte(value, nestingEnd(value, i));
		if (byte !== 47 && byte !== 92) return true;
	}
	return false;
}
function flattenNesting(path) {
	let flat = "";
	let last = 0;
	for (let i = path.indexOf("%"); i !== -1; i = path.indexOf("%", i + 1)) {
		const end = nestingEnd(path, i);
		if (end === i + 1) continue;
		const byte = escapeByte(path, end);
		if (byte === 47 || byte === 92) continue;
		flat += path.slice(last, i) + (byte === -1 ? "%25" : "%");
		last = end;
	}
	return last === 0 ? path : flat + path.slice(last);
}
function nestingEnd(value, index) {
	let end = index + 1;
	while (value.charCodeAt(end) === CHAR_2 && value.charCodeAt(end + 1) === CHAR_5) end += 2;
	return end;
}
function escapeByte(value, index) {
	const high = hexDigit(value.charCodeAt(index));
	const low = hexDigit(value.charCodeAt(index + 1));
	return high === -1 || low === -1 ? -1 : high * 16 + low;
}
function hexDigit(code) {
	if (code >= 48 && code <= 57) return code - 48;
	if (code >= 97 && code <= 102) return code - 87;
	if (code >= 65 && code <= 70) return code - 55;
	return -1;
}
//#endregion
//#region ../../node_modules/.bun/h3@2.0.1-rc.31+d505b50645ee7469/node_modules/h3/dist/normalize.mjs
function mergeMatchedRouteRules(rawLayers, altLayers, canOverride) {
	const resets = /* @__PURE__ */ new Set();
	const routeRules = resolveLayers(rawLayers, resets);
	for (const layers of altLayers || []) unionLayers(routeRules, layers, canOverride, resets);
	return routeRules;
}
function unionLayers(routeRules, layers, canOverride, resets) {
	if (!layers?.length) return;
	const resolved = resolveLayers(layers, resets);
	for (const [name, rule] of Object.entries(resolved)) {
		const current = routeRules[name];
		if (current) {
			if (canOverride && !canOverride(current.route, rule.route)) continue;
		} else if (resets?.has(name) && !rule.handler?.restricting) continue;
		mergeRouteRule(routeRules, name, rule, rule.params);
	}
}
function resolveLayers(layers, resets) {
	const firstData = layers?.[0]?.data;
	if (firstData && !Array.isArray(firstData)) return resolvePreMergedLayers(layers, resets);
	const routeRules = emptyRouteRules();
	for (const layer of orderedLayers(layers)) for (const entry of layer.data) {
		if (entry.options === false) resets?.add(entry.name);
		mergeRouteRule(routeRules, entry.name, entry, layer.params);
	}
	return routeRules;
}
function isMergeableObject(value) {
	return value !== null && typeof value === "object";
}
function emptyRouteRules() {
	return Object.create(null);
}
function mergeRuleOptions(current, incoming) {
	return isMergeableObject(current) && isMergeableObject(incoming) ? {
		...current,
		...incoming
	} : incoming;
}
function orderedLayers(layers) {
	if (!layers || layers.length < 2) return layers || [];
	let ordered = layers;
	for (let i = 1; i < ordered.length; i++) {
		const layer = ordered[i];
		const rank = layerRank(layer);
		let j = i - 1;
		while (j >= 0 && layerRank(ordered[j]) > rank) {
			if (ordered === layers) ordered = [...layers];
			ordered[j + 1] = ordered[j];
			j--;
		}
		if (j + 1 !== i) ordered[j + 1] = layer;
	}
	return ordered;
}
function layerRank(layer) {
	return layer.data[0]?.rank ?? 0;
}
function resolvePreMergedLayers(rawLayers, resets) {
	const layers = rawLayers.length < 2 ? rawLayers : [...rawLayers].sort((a, b) => a.data.rank - b.data.rank);
	const routeRules = emptyRouteRules();
	const winning = layers[layers.length - 1].data;
	if (resets && winning.resets) for (const name of winning.resets) resets.add(name);
	for (const entry of winning.rules) {
		const paramRoutes = entry.paramRoutes;
		let params;
		for (const layer of layers) {
			const layerParams = layer.params;
			if (!layerParams) continue;
			const layerRoute = layer.data.route;
			if (paramRoutes ? paramRoutes.includes(layerRoute) : layerRoute === entry.route) params = params ? {
				...params,
				...layerParams
			} : layerParams;
		}
		routeRules[entry.name] = {
			route: entry.route,
			options: entry.options,
			handler: entry.handler,
			params
		};
	}
	return routeRules;
}
function mergeRouteRule(routeRules, ruleName, rule, params) {
	const name = ruleName;
	const currentRule = routeRules[name];
	if (currentRule) {
		if (rule.options === false) {
			delete routeRules[name];
			return;
		}
		currentRule.options = mergeRuleOptions(currentRule.options, rule.options);
		currentRule.route = rule.route;
		if (currentRule.params || params) currentRule.params = {
			...currentRule.params,
			...params
		};
	} else if (rule.options !== false) routeRules[name] = {
		route: rule.route,
		options: rule.options,
		handler: rule.handler,
		params
	};
}
var headers = {
	order: -1,
	handler: (m) => {
		const entries = Object.entries(m.options || {});
		return async function headersRouteRule(event, next) {
			try {
				return await next();
			} finally {
				for (const [key, value] of entries) {
					event.res.headers.set(key, value);
					event.res.errHeaders.set(key, value);
				}
			}
		};
	}
};
var OPAQUE_SEGMENT_RE = /[()\\]/;
var CONCRETE_SEGMENT_RE = /^[^:*(){}\\]+$/;
var ZERO_MATCHABLE_SEGMENT_RE = /^:.*[?*]$/;
var canOverrideRouteShape = (currentRoute, incomingRoute) => {
	if (currentRoute === incomingRoute) return true;
	const current = currentRoute.split("/");
	const incoming = incomingRoute.split("/");
	for (let i = 0; i < current.length; i++) {
		const cur = current[i];
		if (cur === "**") return i === current.length - 1 && incoming.length > i && !incoming.slice(i).some((segment) => ZERO_MATCHABLE_SEGMENT_RE.test(segment));
		const inc = incoming[i];
		if (inc === void 0) return false;
		if (cur === inc) continue;
		if ((cur === "*" || cur.startsWith(":") && !OPAQUE_SEGMENT_RE.test(cur)) && CONCRETE_SEGMENT_RE.test(inc)) continue;
		return false;
	}
	return current.length === incoming.length;
};
function createMatcherFromFind(findRouteRules, canOverride = canOverrideRouteShape) {
	return (method, pathname) => {
		const rawLayers = findRouteRules(method, pathname);
		let altLayers;
		let hasAltMatch = false;
		const readings = alternateReadings(pathname);
		if (readings) {
			altLayers = [];
			for (const reading of readings) {
				const layers = findRouteRules(method, reading);
				if (layers?.length) hasAltMatch = true;
				altLayers.push(layers);
			}
		}
		if (!rawLayers?.length && !hasAltMatch) return {
			routeRules: {},
			matchedRules: {},
			routeRuleMiddleware: []
		};
		const matchedRules = mergeMatchedRouteRules(rawLayers, altLayers, canOverride);
		return {
			routeRules: toRouteRules(matchedRules),
			matchedRules,
			routeRuleMiddleware: buildRouteRuleMiddleware(matchedRules)
		};
	};
}
function toRouteRules(matchedRules) {
	const routeRules = Object.create(null);
	for (const name in matchedRules) routeRules[name] = matchedRules[name].options;
	return routeRules;
}
function buildRouteRuleMiddleware(matchedRules) {
	const routeRuleMiddleware = [];
	const rules = Object.entries(matchedRules);
	if (rules.length > 1) rules.sort(compareRuleOrder);
	for (const [, rule] of rules) {
		if (!rule.handler) continue;
		routeRuleMiddleware.push(rule.handler.handler(rule));
	}
	return routeRuleMiddleware;
}
function memoizeRouteRulesMatcher(matcher, opts) {
	const max = opts?.max ?? 1024;
	if (max <= 0) return matcher;
	const memo = /* @__PURE__ */ new Map();
	let hand;
	const evict = () => {
		for (;;) {
			let next = hand?.next();
			if (!next || next.done) {
				hand = memo.values();
				next = hand.next();
				if (next.done) return;
			}
			const entry = next.value;
			if (entry.visited) entry.visited = false;
			else {
				memo.delete(entry.key);
				return;
			}
		}
	};
	return (method, pathname) => {
		const key = method + " " + pathname;
		const entry = memo.get(key);
		if (entry) {
			entry.visited = true;
			return entry.result;
		}
		const result = matcher(method, pathname);
		if (memo.size >= max) evict();
		memo.set(key, {
			key,
			result,
			visited: false
		});
		return result;
	};
}
function alternateReadings(pathname) {
	const decoded = decodedPath(pathname);
	if (decoded === pathname && !needsCanonicalPasses(pathname)) return;
	const readings = [];
	for (const spelling of decoded === pathname ? [pathname] : [pathname, decoded]) {
		if (!needsCanonicalPasses(spelling)) {
			pushReading(readings, pathname, spelling);
			continue;
		}
		const canonical = canonicalPath(spelling);
		pushReading(readings, pathname, canonical);
		const merged = mergedCanonicalPath(spelling, canonical);
		if (merged !== void 0) pushReading(readings, pathname, merged);
	}
	return readings.length > 0 ? readings : void 0;
}
function pushReading(readings, pathname, reading) {
	if (reading !== pathname && !readings.includes(reading)) readings.push(reading);
}
var compareRuleOrder = (a, b) => orderWeight(a[1].handler) - orderWeight(b[1].handler) || (a[0] < b[0] ? -1 : 1);
function orderWeight(handler) {
	return handler?.order ?? 0;
}
//#endregion
export { H3Core, HTTPError, NodeResponse, composeMiddleware, createMatcherFromFind, defineHandler, defineLazyEventHandler, headers, memoizeRouteRulesMatcher, serve, toEventHandler, toRequest };
