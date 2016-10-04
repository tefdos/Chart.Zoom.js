// hammer JS for touch support
//var Hammer = require('hammerjs');
var Hammer = typeof(Hammer) === 'function' ? Hammer : window.Hammer;
// Get the chart variable
//var Chart = require('chart.js');
var Chart = typeof(Chart) === 'function' ? Chart : window.Chart;

var helpers = Chart.helpers;

// Take the zoom namespace of Chart
var zoomNS = Chart.Zoom = Chart.Zoom || {};

// Where we store functions to handle different scale types
var zoomFunctions = zoomNS.zoomFunctions = zoomNS.zoomFunctions || {};
var panFunctions = zoomNS.panFunctions = zoomNS.panFunctions || {};

// watch shim

Object.defineProperty(Object.prototype, "swatch", {
	enumerable: false,
	configurable: true,
	writable: false,
	value: function (prop, handler) {
		var
			oldval = this[prop],
			newval = oldval,
			getter = function () {
				return newval;
			},
			setter = function (val) {
				oldval = newval;
				return newval = handler.call(this, prop, oldval, val);
			};

		if (delete this[prop]) { // can't watch constants
			Object.defineProperty(this, prop, {
				get: getter,
				set: setter,
				enumerable: true,
				configurable: true
			});
		}
	}
});

// object.unwatch
Object.defineProperty(Object.prototype, "sunwatch", {
	enumerable: false,
	configurable: true,
	writable: false,
	value: function (prop) {
		var val = this[prop];
		delete this[prop]; // remove accessors
		this[prop] = val;
	}
});

// Default options if none are provided
var defaultOptions = zoomNS.defaults = {
	pan: {
		enabled: true,
		mode: 'xy',
		threshold: 10,
		minLimit: null,
		maxLimit: null
	},
	zoom: {
		enabled: true,
		mode: 'xy',
		minLimit: null,
		maxLimit: null
	}
};

var ch = {};
var zoomValues = {
	min: 0,
	max: 0,
	isZoomed: false
};

function _animate(fn, scale, zoom, center){
	var tid;
	var endAnimation;

	// scaling animation
	tid = setInterval(function(){
		endAnimation = fn(scale, zoom, center);

		ch.update(0);
		if(endAnimation){
			clearInterval(tid);
		}
	}, 30);

}

function throttle(fn, threshhold, scope) {
	threshhold || (threshhold = 250);
	var last,
		deferTimer;
	return function () {
		var context = scope || this;

		var now = +new Date,
			args = arguments;
		if (last && now < last + threshhold) {
			// hold on to it
			clearTimeout(deferTimer);
			deferTimer = setTimeout(function () {
				last = now;
				fn.apply(context, args);
			}, threshhold);
		} else {
			last = now;
			fn.apply(context, args);
		}
	};
}

function directionEnabled(mode, dir) {
	if (mode === undefined) {
		return true;
	} else if (typeof mode === 'string') {
		return mode.indexOf(dir) !== -1;
	}

	return false;
}

function zoomIndexScale(scale, zoom, center) {

	/*var range = scale.max - scale.min;
	 var newDiff = range * (zoom - 1);

	 var cursorPixel = scale.isHorizontal() ? center.x : center.y;
	 var min_percent = (scale.getValueForPixel(cursorPixel) - scale.min) / range;
	 var max_percent = 1 - min_percent;

	 var minDelta = newDiff * min_percent;
	 var maxDelta = newDiff * max_percent;*/
	// for zooming
	if(scale.options.ticks.min < zoomValues.min) scale.options.ticks.min += 1;
	if(scale.options.ticks.max > zoomValues.max) scale.options.ticks.max -= 1;

	// for unzooming
	if(scale.options.ticks.min > zoomValues.min) scale.options.ticks.min -= 1;
	if(scale.options.ticks.max < zoomValues.max) scale.options.ticks.max += 1;

	return !!(scale.options.ticks.min === zoomValues.min && scale.options.ticks.max === zoomValues.max);


}

function zoomTimeScale(scale, zoom, center) {
	var options = scale.options;

	var range;
	var min_percent;
	if (scale.isHorizontal()) {
		range = scale.right - scale.left;
		min_percent = (center.x - scale.left) / range;
	} else {
		range = scale.bottom - scale.top;
		min_percent = (center.y - scale.top) / range;
	}

	var max_percent = 1 - min_percent;
	var newDiff = range * (zoom - 1);

	var minDelta = newDiff * min_percent;
	var maxDelta = newDiff * max_percent;

	options.time.min = scale.getValueForPixel(scale.getPixelForValue(scale.firstTick) + minDelta);
	options.time.max = scale.getValueForPixel(scale.getPixelForValue(scale.lastTick) - maxDelta);
}

function zoomNumericalScale(scale, zoom, center) {
	var range = scale.max - scale.min;
	var newDiff = range * (zoom - 1);

	var cursorPixel = scale.isHorizontal() ? center.x : center.y;
	var min_percent = (scale.getValueForPixel(cursorPixel) - scale.min) / range;
	var max_percent = 1 - min_percent;

	var minDelta = newDiff * min_percent;
	var maxDelta = newDiff * max_percent;

	scale.options.ticks.min = scale.min + minDelta;
	scale.options.ticks.max = scale.max - maxDelta;
}

function zoomScale(scale, zoom, center) {
	var fn = zoomFunctions[scale.options.type];
	if (fn) {
		_animate(fn, scale, zoom, center);
	}
}

function doZoom(chartInstance, zoom, center) {
	var ca = chartInstance.chartArea;
	if (!center) {
		center = {
			x: (ca.left + ca.right) / 2,
			y: (ca.top + ca.bottom) / 2,
		};
	}

	var zoomOptions = chartInstance.options.zoom;

	if (zoomOptions && helpers.getValueOrDefault(zoomOptions.enabled, defaultOptions.zoom.enabled)) {
		// Do the zoom here
		var zoomMode = helpers.getValueOrDefault(chartInstance.options.zoom.mode, defaultOptions.zoom.mode);

		helpers.each(chartInstance.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(zoomMode, 'x')) {
				zoomScale(scale, zoom, center);
			} else if (directionEnabled(zoomMode, 'y')) {
				// Do Y zoom
				zoomScale(scale, zoom, center);
			}
		});

		chartInstance.update(0);
	}
}

function panIndexScale(scale, delta) {
	var options = scale.options;
	// calculate delta from value
	var newDelta = delta - options.ticks.max;

	if(newDelta > 0){
		if(options.ticks.max < ch.options.pan.maxLimit){
			options.ticks.min += newDelta;//parseInt(labels[minIndex]);
			options.ticks.max += newDelta;//parseInt(labels[maxIndex]);
		}
	}
	else{
		if(options.ticks.min > ch.options.pan.minLimit){
			options.ticks.min -= Math.abs(newDelta);//parseInt(labels[minIndex]);
			options.ticks.max -= Math.abs(newDelta);//parseInt(labels[maxIndex]);
		}
	}

	//zoomValues.min = options.ticks.min;
	//zoomValues.max = options.ticks.max;

	ch.options.pan.callback({
		min: options.ticks.min,
		max: options.ticks.max
	}, newDelta);

}

function panTimeScale(scale, delta) {
	var options = scale.options;
	options.time.min = scale.getValueForPixel(scale.getPixelForValue(scale.firstTick) - delta);
	options.time.max = scale.getValueForPixel(scale.getPixelForValue(scale.lastTick) - delta);
}

function panNumericalScale(scale, delta) {
	var tickOpts = scale.options.ticks;
	var start = scale.start,
		end = scale.end;

	if (tickOpts.reverse) {
		tickOpts.max = scale.getValueForPixel(scale.getPixelForValue(start) - delta);
		tickOpts.min = scale.getValueForPixel(scale.getPixelForValue(end) - delta);
	} else {
		tickOpts.min = scale.getValueForPixel(scale.getPixelForValue(start) - delta);
		tickOpts.max = scale.getValueForPixel(scale.getPixelForValue(end) - delta);
	}
}

function panScale(scale, delta) {
	var fn = panFunctions[scale.options.type];
	if (fn) {
		fn(scale, delta);
	}
}

function doPan(chartInstance, deltaX, deltaY) {
	var panOptions = chartInstance.options.pan;
	if (panOptions && helpers.getValueOrDefault(panOptions.enabled, defaultOptions.pan.enabled)) {
		var panMode = helpers.getValueOrDefault(chartInstance.options.pan.mode, defaultOptions.pan.mode);

		helpers.each(chartInstance.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(panMode, 'x') && deltaX !== 0) {
				panScale(scale, deltaX);
			} else if (!scale.isHorizontal() && directionEnabled(panMode, 'y') && deltaY !== 0) {
				panScale(scale, deltaY);
			}
		});

		chartInstance.update(0);
	}
}

function positionInChartArea(chartInstance, position) {
	return 	(position.x >= chartInstance.chartArea.left && position.x <= chartInstance.chartArea.right) &&
		(position.y >= chartInstance.chartArea.top && position.y <= chartInstance.chartArea.bottom);
}

function getYAxis(chartInstance) {
	var scales = chartInstance.scales;

	for (var scaleId in scales) {
		var scale = scales[scaleId];

		if (!scale.isHorizontal()) {
			return scale;
		}
	}
}

// Store these for later
zoomNS.zoomFunctions.category = zoomIndexScale;
zoomNS.zoomFunctions.time = zoomTimeScale;
zoomNS.zoomFunctions.linear = zoomNumericalScale;
zoomNS.zoomFunctions.logarithmic = zoomNumericalScale;
zoomNS.panFunctions.category = panIndexScale;
zoomNS.panFunctions.time = panTimeScale;
zoomNS.panFunctions.linear = panNumericalScale;
zoomNS.panFunctions.logarithmic = panNumericalScale;

// Chartjs Zoom Plugin
var zoomPlugin = {
	afterInit: function(chartInstance) {
		helpers.each(chartInstance.scales, function(scale) {
			scale.originalOptions = JSON.parse(JSON.stringify(scale.options));
		});

		chartInstance.resetZoom = function() {
			helpers.each(chartInstance.scales, function(scale, id) {
				var timeOptions = scale.options.time;
				var tickOptions = scale.options.ticks;

				if (timeOptions) {
					delete timeOptions.min;
					delete timeOptions.max;
				}

				if (tickOptions) {
					delete tickOptions.min;
					delete tickOptions.max;
				}

				scale.options = helpers.configMerge(scale.options, scale.originalOptions);
			});

			helpers.each(chartInstance.data.datasets, function(dataset, id) {
				dataset._meta = null;
			});

			chartInstance.update();
		};
	},
	beforeInit: function(chartInstance) {
		var node = chartInstance.chart.ctx.canvas;
		var options = chartInstance.options;
		var panThreshold = helpers.getValueOrDefault(options.pan ? options.pan.threshold : undefined, zoomNS.defaults.pan.threshold);
		ch = chartInstance; // global chart instance

		if(options.hasOwnProperty('zoom')){
			options.zoom.swatch('isZoomed', function(prop, oldval, newval){
				var yAxis = getYAxis(chartInstance);
				var zoom = 1.1;
				zoomValues.isZoomed = newval;
				if (!newval) {
					zoom = 0.9;
					zoomValues.min = options.zoom.defaultMinLimit;
					zoomValues.max = options.zoom.defaultMaxLimit;
				}
				else{
					zoomValues.min = options.zoom.minLimit;
					zoomValues.max = options.zoom.maxLimit;
				}

				doZoom(chartInstance, zoom, {
					x: options.zoom.centerPoint,
					y: (yAxis.bottom - yAxis.top) / 2,
				});
			});
		}


		/*if (options.zoom.drag) {
		 // Only want to zoom horizontal axis
		 options.zoom.mode = 'x';
		 node.addEventListener('mousedown', function(event){
		 chartInstance._dragZoomStart = event;
		 });

		 node.addEventListener('mousemove', function(event){
		 if (chartInstance._dragZoomStart) {
		 chartInstance._dragZoomEnd = event;
		 chartInstance.update(0);
		 }

		 chartInstance.update(0);
		 });

		 node.addEventListener('mouseup', function(event){
		 if (chartInstance._dragZoomStart) {
		 var chartArea = chartInstance.chartArea;
		 var yAxis = getYAxis(chartInstance);
		 var beginPoint = chartInstance._dragZoomStart;
		 var startX = Math.min(beginPoint.x, event.x) ;
		 var endX = Math.max(beginPoint.x, event.x);
		 var dragDistance = endX - startX;
		 var chartDistance = chartArea.right - chartArea.left;
		 var zoom = 1 + ((chartDistance - dragDistance) / chartDistance );

		 if (dragDistance > 0) {
		 doZoom(chartInstance, zoom, {
		 x: (dragDistance / 2) + startX,
		 y: (yAxis.bottom - yAxis.top) / 2,
		 });
		 }

		 chartInstance._dragZoomStart = null;
		 chartInstance._dragZoomEnd = null;
		 }
		 });
		 }
		 else {
		 var wheelHandler = function(e) {
		 e.preventDefault();
		 var rect = e.target.getBoundingClientRect();
		 var offsetX = e.clientX - rect.left;
		 var offsetY = e.clientY - rect.top;

		 var center = {
		 x : offsetX,
		 y : offsetY
		 };

		 if (e.deltaY < 0) {
		 doZoom(chartInstance, 1.1, center);
		 } else {
		 doZoom(chartInstance, 0.909, center);
		 }
		 };
		 chartInstance._wheelHandler = wheelHandler;

		 node.addEventListener('wheel', wheelHandler);
		 }*/

		if (Hammer) {
			var mc = new Hammer.Manager(node);
			//mc.add(new Hammer.Pinch());
			mc.add(new Hammer.Pan({
				threshold: panThreshold
			}));

			options.pan.swatch('delta', function(prop, oldval, newval){
				doPan(chartInstance, newval, null);
			});

			chartInstance._mc = mc;
		}
	},

	beforeDatasetsDraw: function(chartInstance) {
		var ctx = chartInstance.chart.ctx;
		var chartArea = chartInstance.chartArea;
		ctx.save();
		ctx.beginPath();

		if (chartInstance._dragZoomEnd) {
			var yAxis = getYAxis(chartInstance);
			var beginPoint = chartInstance._dragZoomStart;
			var endPoint = chartInstance._dragZoomEnd;
			var startX = Math.min(beginPoint.x, endPoint.x);
			var endX = Math.max(beginPoint.x, endPoint.x);
			var rectWidth = endX - startX;


			ctx.fillStyle = 'rgba(225,225,225,0.3)';
			ctx.lineWidth = 5;
			ctx.fillRect(startX, yAxis.top, rectWidth, yAxis.bottom - yAxis.top);
		}

		ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
		ctx.clip();
	},

	afterDatasetsDraw: function(chartInstance) {
		chartInstance.chart.ctx.restore();
	},

	destroy: function(chartInstance) {
		var node = chartInstance.chart.ctx.canvas;
		node.removeEventListener('wheel', chartInstance._wheelHandler);

		var mc = chartInstance._mc;
		if (mc) {
			mc.remove('pinchstart');
			mc.remove('pinch');
			mc.remove('pinchend');
			mc.remove('panstart');
			mc.remove('pan');
			mc.remove('panend');
		}
	}
};

Chart.pluginService.register(zoomPlugin);
