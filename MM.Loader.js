var MM = MM || {};

// browserify & webpack support
if ( typeof module === 'object' ) {
	module.exports = MM;
}

MM.Loader = (function() {

	function Loader() {

		this.numItems = 0;
		this.numItemsLoaded = 0;

		this.currentLoads = [];
		this.loadQueue = [];
		this.progress = 0;

		this.onProgress = null;
		this.onFileLoad = null;
		this.onComplete = null;

		this.worker = getWorkerInstance(document.getElementById("worker-xhr").textContent);
		self = this;
		this.worker.onmessage = function(event) {
			data = event.data;
			switch (data.proxy) {
				case "onprogress":
					self.handleFileProgress(data.data);
					break;
				case "oncomplete":
					self.handleFileComplete(data.data);
					break;
			}
		}
	}

	Loader.prototype.handleFileComplete = function(event) {
		var item = this.findBySrc(this.currentLoads, event.src);
		this.removeLoadItem(event.src);
		item.result = this.createResult(item, event.response );
		delete(item.progress);

		switch (item.type) {
			case "image":
				var _this = this;
				item.result.onload = function() {
					_this.handleFileTagComplete(item);
				};
				return;
				break;
			case "svg":
			case "sound":
				break;
			default:
				break;
		}
		this.handleFileTagComplete(item);
	};

	Loader.prototype.handleFileProgress = function(event) {
		var item = this.findBySrc(this.currentLoads, event.src);
		if(item == undefined) {
			return;
		}
		item.progress = event.loaded / event.total;
		this.updateProgress()
	}

	Loader.prototype.handleFileTagComplete = function(item) {
		this.numItemsLoaded++;
		this.updateProgress();
		if(this.onFileLoad) {
			this.onFileLoad(item);
		}

		this.loadNext();
	};

	Loader.prototype.abort = function(file) {
		this.worker.postMessage({ proxy:"abort", file: file });
	};

	Loader.prototype.clean = function() {
		this.currentLoads = [];
		this.loadQueue = [];
		this.numItems = 0;
		this.numItemsLoaded = 0;
		this.progress = 0;
	}

	/**
	* If you call load method during a previous load, it will abort it.
	* If you pass true as a parameter, we consider you want to store the previous load aborted which will be reload after the new load.
	**/
	Loader.prototype.load = function(manifest, priority) {
		var data;

		priority = priority || false;
		if(this.currentLoads.length > 0) {
			var tmp = [];
			for(var i = 0; i < this.currentLoads.length; i++) {
				this.abort(this.currentLoads[i]);
				if(priority) {
					tmp.push({ src:this.currentLoads[i].src, id:this.currentLoads[i].id })
				}
			}
			
			this.clean();
			manifest = manifest.concat(tmp)
		}

		if (manifest instanceof Array) {
			if (manifest.length === 0) {
				console.error("Manifest is empty.");
				return;
			}
			data = manifest;
		} else {
			if (manifest === null) {
				console.error("Manifest is null.");
				return;
			}
			data = [manifest];
		}
		for (var i = 0, l = data.length; i < l; i++) {
			var loadItem = this.createLoadItem(data[i]);
			if (loadItem !== null) {
				this.loadQueue.push(loadItem);
				this.numItems++;
			}
		}

		this.updateProgress();
		this.loadNext();
	};

	Loader.prototype.loadNext = function() {
		var loadItem;

		if (this.numItems === this.numItemsLoaded) {
			if(this.onComplete) {
				this.onComplete({target: this});
			}
		}

		while (this.loadQueue.length) {
			loadItem = this.loadQueue.shift();
			this.currentLoads.push(loadItem);
		}
	};

	Loader.prototype.findBySrc = function(array, src) {
		for (var i = 0, l = array.length; i < l; i++) {
			if(array[i].src == src) {
				return array[i];
			}
		}
	}

	Loader.prototype.updateProgress = function() {
		var loaded = this.numItemsLoaded / this.numItems;
		var remaining = this.numItems - this.numItemsLoaded;
		if (remaining > 0) {
			var chunk = 0;
			for (var i = 0, l = this.currentLoads.length; i < l; i++) {
				if(this.currentLoads[i].progress == undefined) {
					this.currentLoads[i].progress = 0;
				}
				chunk += this.currentLoads[i].progress;
			}

			loaded += (chunk / remaining) * (remaining / this.numItems);
		}

		var event = { loaded: loaded, total: 1 };
		this.progress = event.loaded / event.total;
		if (isNaN(this.progress) || this.progress === Infinity) {
			this.progress = 0;
		}
		event.target = this;
		if (this.onProgress) {
			this.onProgress(event);
		}

	};

	Loader.prototype.removeLoadItem = function(src) {
		i = this.currentLoads.length;
		while (i--) {
			if (this.currentLoads[i].src == src) {
				this.currentLoads.splice(i, 1);
				break;
			}
		}
	};

	Loader.prototype.createResult = function(item, data) {
		var tag = null;
		var resultData;
		switch (item.type) {
			case "image":
				tag = this.createImage();
				break;
			case "sound":
				tag = item.tag || this.createAudio();
				break;
			case "css":
				tag = this.createLink();
				break;
			case "svg":
				tag = this.createSVG();
				tag.appendChild(this.createXML(data, "image/svg+xml"));
				break;
			case "xml":
				resultData = this.createXML(data, "text/xml");
				break;
			case "json":
			case "text":
				resultData = data;
		}

		if (tag) {
			if (item.type === "css") {
				tag.href = item.src;
			} else if (item.type !== "svg") {
				tag.src = item.src;
			}
			return tag;
		} else {
			return resultData;
		}
	};

	Loader.prototype.createXML = function(data, type) {
		var resultData;
		var parser;

		if (window.DOMParser) {
			/*global DOMParser */
			parser = new DOMParser();
			resultData = parser.parseFromString(data, type);
		} else {
			// Internet Explorer
			parser = new ActiveXObject("Microsoft.XMLDOM");
			parser.async = false;
			parser.loadXML(data);
			resultData = parser;
		}

		return resultData;
	};

	Loader.prototype.createLoadItem = function(loadItem) {
		var item = {};

		switch (typeof(loadItem)) {
			case "string":
				item.src = loadItem;
				break;
			case "object":
				if (loadItem instanceof HTMLAudioElement) {
					item.tag = loadItem;
					item.src = item.tag.src;
					item.type = "sound";
				} else {
					item = loadItem;
				}
				break;
			default:
				break;
		}

		item.extension = this.getNameAfter(item.src, ".");
		if (!item.type) {
			item.type = this.getType(item.extension);
		}

		if (item.id === null || item.id === "") {
			item.id = item.src;
		}

		this.worker.postMessage({ proxy:"load", data: item });
		return item;
	};

	Loader.prototype.getType = function(ext) {
		switch (ext) {
			case "jpeg":
			case "jpg":
			case "gif":
			case "png":
			case "webp":
			case "bmp":
				return "image";
			case "ogg":
			case "mp3":
			case "webm":
				return "sound";
			case "json":
				return "json";
			case "xml":
				return "xml";
			case "css":
				return "css";
			case 'svg':
				return "svg";
			default:
				return "text";
		}
	};

	Loader.prototype.getNameAfter = function(path, token) {
		var dotIndex = path.lastIndexOf(token);
		var lastPiece = path.substr(dotIndex + 1);
		var endIndex = lastPiece.lastIndexOf(/[\b|\?|#|\s]/);
		return (endIndex === -1) ? lastPiece : lastPiece.substr(0, endIndex);
	};

	Loader.prototype.createImage = function() {
		return document.createElement("img");
	};

	Loader.prototype.createSVG = function() {
		var tag = document.createElement("object");
		tag.type = "image/svg+xml";
		return tag;
	};

	Loader.prototype.createAudio = function() {
		var tag = document.createElement("audio");
		tag.autoplay = false;
		tag.type = "audio/ogg";
		return tag;
	};

	Loader.prototype.createScript = function() {
		var tag = document.createElement("script");
		tag.type = "text/javascript";
		return tag;
	};

	Loader.prototype.createLink = function() {
		var tag = document.createElement("link");
		tag.type = "text/css";
		tag.rel = "stylesheet";
		return tag;
	};

	return Loader;

})();
