var gulp = require('gulp');
var ts = require('gulp-typescript');

gulp.task('default', function () {
	gulp.run('compile');
});

gulp.task('compile', function () {
	var tsResult = gulp.src(['./**/*.ts', '!./node_modules/**/*.*'])
	.pipe(ts({
		target: 'es5',
		module: 'commonjs',
		noExternalResolve: true
	}));
	
	return tsResult.js.pipe(gulp.dest('./'));
});