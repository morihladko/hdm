(function(global) {
	'use strict';

	var PLANE_WIDTH = 183,
		PLANE_HEIGH = 78,
		PLANE_OFF_X = 50,
		PLANE_OFF_Y = 50,
		PLANE_URL = 'static/img/lietadlo.png';

	var points = [
		[810, 190],
		[500, 100],
		[220, 335]
	];

	var line = d3.svg.line()
		.tension(0.2)
		.interpolate("cardinal");	

	var svg = d3.select("#map").append("svg")
		.datum(points)
		.attr("width", 960)
		.attr("height", 500);

	var path = svg.append("path")
		.style("stroke", "#ddd")
		.style("stroke-width", 20)
		.style("stroke-dasharray", "40, 10")
		.attr("d", line);

	var progressPath = svg.append("path")
		.attr("d", line)
		.style("stroke", '#39b54a')
		.style("stroke-width", 20)
		.attr("visibility", "hidden");

	var plane = svg.append("svg:image")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", PLANE_WIDTH)
		.attr("height", PLANE_HEIGH)
		.attr("xlink:href", PLANE_URL)
		.attr("transform", "translate(" + [points[0][0] - PLANE_OFF_X, points[0][1] - PLANE_OFF_Y] + ")");

	function pathTransition(path) {
		path.transition()
			.duration(2000)
			.attrTween("stroke-dasharray", tweenDash);
	}

	function planeTransition(plane) {
		plane.transition()
			.duration(2000)
			.attrTween("transform", translateAlong(path.node()));
	}

	function tweenDash() {
		var l = this.getTotalLength(),
			i = d3.interpolateString("0," + l, (l * global.currentPos) + "," + l);
		
		return function(t) { return i(t); };
	}	

	function translateAlong(path) {
		var l = path.getTotalLength() * global.currentPos;
		
		return function(d, i, a) {
			return function(t) {
				var p = path.getPointAtLength(t * l);
				return "translate(" + (p.x - PLANE_OFF_X) + "," + (p.y - PLANE_OFF_Y) + ")";
			};
		};
	}

	global.mapAnimate = function() {
		plane
			.attr("transform", "translate(" + [points[0][0] - PLANE_OFF_X, points[0][1] - PLANE_OFF_Y] + ")")
			.call(planeTransition);

		progressPath
			.attr("visibility", "visible")
			.call(pathTransition);
	}
}(this));
