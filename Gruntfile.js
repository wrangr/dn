module.exports = function (grunt) {

  grunt.initConfig({
  
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      files: [
        'Gruntfile.js',
        'index.js',
        'test/**/*.js'
      ]
    },

    shell: {
      test: {
        command: './node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha test/test-index.js'
      }
    },

    watch: {
      all: {
        files: [ '<%= jshint.files %>' ],
        tasks: [ 'test' ]
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('default', [ 'test' ]);
  grunt.registerTask('test', [ 'jshint', 'shell:test' ]);

};
