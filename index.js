const http = require("http");
const fs = require("fs");

const server = http.createServer();

mimeTypes = {
  html: "text/html",
  php: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/png",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  json: "application/json",
  js: "text/javascript",
  css: "text/css",
};

server
  .on("request", (request, response) => {
    let type = "utf-8";
    if (request.url.endsWith(".png") || request.url.endsWith(".gif") || request.url.endsWith(".jpg") || request.url.endsWith(".ico")) type = "binary";

    if (request.url == "/") {
      response.end(
        fs.readFileSync(__dirname + "/src/index.html", "utf-8"),
        type
      );
    } else if (fs.existsSync(__dirname + "/src/" + request.url)) {
      response.writeHead(200, {
        "Content-Type": mimeTypes[request.url.split(".").pop()] || "text/plain",
      });
      response.end(
        fs.readFileSync(__dirname + "/src/" + request.url, type),
        type
      );
    } else {
      response.writeHead(404);
      response.end("You requested a nonexistent file.");
    }
  })
  .listen(80);
