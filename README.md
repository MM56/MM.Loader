MM.Loader
===========

Most of the time, single threaded JavaScript preloading is just fine. But what happens when you have some complex animations during a preload ? If it runs on the UI thread, it’ll causes some troubles like freeze. 
MM.Loader creates a Web Worker to preload your assets with XHR and simply dispatches the response.
MM.Loader was inspired by [PreloadJS](http://www.createjs.com/docs/preloadjs/modules/PreloadJS.html).

> [PreloadJS](http://www.createjs.com/docs/preloadjs/modules/PreloadJS.html) makes preloading assets & getting aggregate progress events easier in JavaScript. It uses XHR2 when available, and falls back to tag-based loading when not.

Demo
---------------------
This demo simply preloads a large asset (16MB) to check if it causes some troubles during animations.

Compatibility
---------------------
[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Tested in Chrome. Check on [Can I use](http://caniuse.com/#feat=webworkers) if your browser supports Web Workers.