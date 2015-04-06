var path = require('path'),
  gulp = require('gulp'),
  connect = require('gulp-connect'),
  bpjs = require('boilerplate-gulp-js');

bpjs(gulp, {
  name: 'P',
  entry: './index.js',
  sources: './lib/**/*.js',
  tests: './test/**/*.js',
  dest: './dist'
});

function server(){
  connect.server({
    root: ['./dist', './examples']
  });
}

gulp.task('build', gulp.series('bpjs:build'));

gulp.task('dev', gulp.parallel('bpjs:dev', server));
