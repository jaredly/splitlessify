var should = require('should')
  , browserify = require('browserify')
  , splitlessify = require('../index')
  , fs = require('fs')
  , rmdir = require('rimraf')
  , touch = require('touch')
  , ncp = require('ncp');

describe('splitlessify', function() {
  before(function() {
    try {
      fs.mkdirSync('./test/tmp');
    } catch(e) {
      if (e.code === 'EEXIST') {
        rmdir('./test/tmp/*', function(){});
      } else {
        throw(e);
      }
    }
  });
  after(function() {
    rmdir('./test/tmp', function(){});
  });
  beforeEach(function() {
    b = browserify();
  });

  it('processes LESS files into CSS transparently', function(done) {
    b.plugin(splitlessify, {
      filename: './test/tmp/out_less.css'
    });
    b.on('splitlessify:end', function(emit) {
      fs.existsSync('./test/tmp/out_less.css').should.eql(true);

      // check the generated file and make sure it looks the way it's supposed to
      var css = fs.readFileSync('./test/tmp/out_less.css', { encoding: 'utf-8' });
      css.should.match(/\.greenthing {/);
      css.should.match(/color: green/);
      done();
    });

    b.add('./test/shims/less/test.js');
    b.bundle().pipe(fs.createWriteStream('/dev/null'));
  });

  describe('with custom settings', function() {
    it('passes through LESS settings for the parser', function(done) {
      b.plugin(splitlessify, {
        filename: './test/tmp/out_custom.css',
        parser: {
          paths: ['./test/shims/other'],
          relativeUrls: false
        }
      });
      b.on('splitlessify:end', function(filenames) {
        fs.existsSync('./test/tmp/out_custom.css').should.eql(true);

        // check the generated file and make sure it looks the way it's supposed to
        var css = fs.readFileSync('./test/tmp/out_custom.css', { encoding: 'utf-8' });

        css.should.match(/\.foo {/);
        css.should.match(/\.thingy {/);

        done();
      });

      b.add('./test/shims/less/test_custom.js');
      b.bundle().pipe(fs.createWriteStream('/dev/null'));
    });

    it('passes through LESS settings for toCSS', function(done) {
      b.plugin(splitlessify, {
        filename: './test/tmp/out_compress.css',
        toCSS: {
          compress: true
        }
      });
      b.on('splitlessify:end', function() {
        fs.existsSync('./test/tmp/out_compress.css').should.eql(true);

        // check the generated file and make sure it looks the way it's supposed to
        var css = fs.readFileSync('./test/tmp/out_compress.css', { encoding: 'utf-8' });
        css.should.match(/\.greenthing{color:green}\.foo{color:green}/m);

        done();
      });

      b.add('./test/shims/less/test.js');
      b.bundle().pipe(fs.createWriteStream('/dev/null'));
    });

    it('accepts a callback parameter', function(done) {
      b.plugin(splitlessify, {
        filename: './test/tmp/out_callback.css',
        callback: function(files) {
          done();
        }
      });
      b.add('./test/shims/less/test.js');
      b.bundle().pipe(fs.createWriteStream('/dev/null'));
    });

    it('accepts an errback parameter', function(done) {
      var doneYet = false;
      b.plugin(splitlessify, {
        filename: './test/tmp/out_errback.css',
        errback: function(e) {
          if (!doneYet) {
            done();
            doneYet = true;
          }
        }
      });
      b.add('./test/shims/less/testerror.js');
      b.bundle().pipe(fs.createWriteStream('/dev/null'));
    });

    it('can watch changes to LESS files in the dependency graph and regenerate', function(done) {
      b.plugin(splitlessify, {
        filename: './test/tmp/out_watch.css',
        watch: true
      });

      // prep the test by copying shim files, as we need to modify them
      ncp('./test/shims/less', './test/tmp/less', { clobber: true }, function() {
        b.add('./test/tmp/less/test.js');
        b.on('splitlessify:update', function(bundle, filename) {
          done();
        });

        b.bundle().pipe(fs.createWriteStream('/dev/null'));

        // for some reason, chokidar needs a little time to register changes.
        // if we don't set a long timeout (say, 1s), we get nondeterministic failures.
        setTimeout(function() {
          touch('./test/tmp/less/test2.less');
        }, 1000);
      });
    });
  });
});
