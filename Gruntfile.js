module.exports = function (grunt) {

  grunt.initConfig({
  
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      files: [
        'Gruntfile.js',
        'index.js',
        'bin/**/*.js',
        'lib/**/*.js',
        'test/**/*.js'
      ]
    },

    shell: {
      test: {
        command: './node_modules/.bin/mocha test/*.spec.js'
      },
      cover: {
        command: './node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha test/*.spec.js'
      }
    },

    watch: {
      all: {
        files: [ '<%= jshint.files %>' ],
        tasks: [ 'jshint', 'shell:test' ]
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('default', [ 'test' ]);
  grunt.registerTask('test', [ 'jshint', 'shell:test' ]);
  grunt.registerTask('cover', [ 'jshint', 'shell:cover' ]);

};
