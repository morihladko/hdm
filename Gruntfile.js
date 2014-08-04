'use strict';

module.exports = function(grunt) {
	grunt.initConfig({
		app: {
			src: 'static/',
		},

		jshint: {
			options: {
				reporter: require('jshint-stylish')
			},
			target: ['<%= app.src %>/js/s.js']
		},

		uglify: {
			dist: {
				files: {
					'<%= app.src %>/js/min.js': '<%= app.src %>/js/s.js',
					'<%= app.src %>/js/vendor.min.js': '<%= app.src %>/js/vendor/**/*.js'
				}
			}
		},

		bower: {
			install: {
				options: {
					targetDir: '<%= app.src %>/js/vendor/'
				}
			}
		},

		clean: {
			js_libs: {
				src: ['<%= app.src %>/js/vendor/*']
			},
			bordel: {
				src: ['<%= app.src %>/js/vendor/modernizr/*', '!<%= app.src %>/js/vendor/modernizr/modernizr.js']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-bower-task');

	grunt.registerTask('default', ['jshint', 'uglify']);
	grunt.registerTask('js_libs', ['clean:js_libs', 'bower:install', 'clean:bordel']);
};

