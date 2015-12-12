'use strict';


const Gulp = require('gulp');
const Eslint = require('gulp-eslint');
const Mocha = require('gulp-mocha');
const Istanbul = require('gulp-istanbul');


const internals = {
  files: ['gulpfile.js', 'index.js', 'bin/**/*.js', 'test/**/*.js']
};


Gulp.task('lint', () => {

  return Gulp.src(internals.files)
    .pipe(Eslint())
    .pipe(Eslint.format())
    .pipe(Eslint.failAfterError());
});


Gulp.task('test', ['lint'], (done) => {

  Gulp.src(['index.js'])
    .pipe(Istanbul())
    .pipe(Istanbul.hookRequire())
    .on('finish', () => {

      Gulp.src('test/**/*.spec.js', { read: false })
        .pipe(Mocha())
        .pipe(Istanbul.writeReports()) // Creating the reports after tests runned
        .on('end', done);
    });
});


Gulp.task('watch', () => {

  Gulp.watch(internals.files, ['test']);
});


Gulp.task('default', ['test']);

