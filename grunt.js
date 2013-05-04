module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    hug: {
      client: {
        src: './script/**/*.js',
        dest: 'build/script.js',
        path: ['./components']
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
        tasks: 'hug min reload'
      },
      style: {
        files: ['./style/**/*'],
        tasks: 'concat sass reload'
      },
      statics: {
        files: ['./index.html', './template/**/*'],
        tasks: 'reload'
      }
    },
    server: {
      port: 81,
      base: './'
    },
    reload: {
        port: 80,
        proxy: {
            host: 'localhost'
        }
    },
    sass: {
      styles:{
        files: {
          './dist/style.css': './build/style.scss'
        }
      }
    },
    min: {
      scripts: {
        src: './build/script.js',
        dest: './dist/script.js'
      }
    },
    clean: {
      build: ['./build/']
    }
  });

  grunt.loadNpmTasks('grunt-hug');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-reload');

  grunt.registerTask('dev', 'default server reload watch');
  grunt.registerTask('default', 'clean hug concat sass min');
};