module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    browserify: {
      client: {
        files: {
          'build/script.js': ['script/*.js']
        }
      }
    },
    concat:{
      styles: {
        src: ['./resource/bootstrap.min.css', './resource/prettify.css', './style/**/*.scss'],
        dest: './build/style.scss'
      },
    },
    watch: {
      script: {
        files: ['./script/**/*'],
        tasks: ['hug', 'uglify']
      },
      style: {
        files: ['./style/**/*'],
        tasks: ['concat', 'sass']
      },
      statics: {
        files: ['./index.html', './template/**/*'],
        tasks: ['reload']
      }
    },
    connect: {
      server:{
        port: 80,
        base: './'
      }
    },
    sass: {
      styles:{
        files: {
          './dist/style.css': './build/style.scss'
        }
      }
    },
    uglify: {
      scripts: {
        src: './build/script.js',
        dest: './dist/script.js'
      }
    },
    clean: {
      build: ['./build/']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-reload');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.registerTask('dev', ['default', 'connect', 'watch']);
  grunt.registerTask('default', ['clean', 'browserify', 'concat', 'sass', 'uglify']);
};