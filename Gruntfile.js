var path = require('path');
var lrSnippet = require('grunt-contrib-livereload/lib/utils').livereloadSnippet;
var folderMount = function folderMount(connect, point) {
  return connect.static(path.resolve(point));
};

module.exports = function(grunt) {
  //grunt.loadNpmTasks('grunt-contrib-livereload');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy'); 
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-hug');
  
  var config = {
    properties: {
      buildDir: './build',
      distDir: './dist',
      libDir: './lib',
      devDir: './dev',
      devServerDir: '<%= properties.buildDir %>/dev'
    },
    clean: {
      build: ['<%= properties.buildDir %>'],
      dist: ['<%= properties.distDir %>']
    },
    
    hug: {
      p:{
        src: ["<%= properties.libDir %>/**"],
        dest: "<%= properties.buildDir %>/p.max.js",
        path: ["./components"]
      }
    },
    
    copy: {
      pDev:{
        files: [{
            dest: '<%= properties.devServerDir %>/p.js',
            src: '<%= hug.p.dest %>'
        },{
            dest: '<%= properties.devServerDir %>',
            src: 'examples/**',
            expand: true
        }
        ]
      }
    },

    watch: {
      p: {
        files: ['<%= properties.libDir %>/**', 'examples/**'],
        tasks: ["hug:p", "copy:pDev"]
      }
    },

    connect: {
      p: {
        options: {
          hostname: "*",
          port:80,
          base: './build/dev'
        }
      }
    },

    jshint: {
      options: {
        camelcase: true,
        strict: false,
        trailing: false,
        curly: false,
        eqeqeq: false,
        immed: true,
        latedef: false,
        newcap: true,
        noarg: true,
        sub: true,
        evil:true,
        undef: true,
        boss: true,
        eqnull: true,
        smarttabs: true,
        browser:true,
        es5: true
      },
      globals: {
        console: true,
        angular: true,
        turn: true,
        module: true,
        exports: true,
        require: true,
        moment: true,
        $ : true
      }
    }
  };

  grunt.registerTask('default', 'hug:p');
  grunt.registerTask('dev', [
    'hug:p', 
    'copy:pDev', 
    'connect', 
    'watch'
  ]);

  grunt.initConfig(config);
};
