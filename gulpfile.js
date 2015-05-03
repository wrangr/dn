var gulp = require('gulp');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');


var files = [ 'gulpfile.js', 'index.js', 'bin/**/*.js', 'test/**/*.js' ];


gulp.task('lint', function () {
  return gulp.src(files)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});


gulp.task('test', [ 'lint' ], function (cb) {
  gulp.src([ 'index.js' ])
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
    .on('finish', function () {
      gulp.src('test/**/*.spec.js', { read: false })
        .pipe(mocha())
        .pipe(istanbul.writeReports()) // Creating the reports after tests runned
        .on('end', cb);
    });
});


gulp.task('watch', function () {
  gulp.watch(files, [ 'test' ]);
});


gulp.task('default', [ 'test' ]);

