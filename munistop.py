from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app
import os
from google.appengine.ext.webapp import template
import nextbus
from django.utils.simplejson import JSONEncoder
import datetime

class RoutesController(webapp.RequestHandler):
  def get(self):
    routes = nextbus.scrapeRoutes()
    self.response.out.write(JSONEncoder().encode(routes))

class DirectionsController(webapp.RequestHandler):
  def get(self, route):
    directions = nextbus.scrapeDirections(route)
    self.response.out.write(JSONEncoder().encode(directions))

class StopsController(webapp.RequestHandler):
  def get(self, route, direction):
    stops = nextbus.scrapeStops(route, direction)
    self.response.out.write(JSONEncoder().encode(stops))

class TimeController(webapp.RequestHandler):
  def get(self, route, direction, stop):
    times = nextbus.scrapeTime(route, direction, stop)
    self.response.out.write(JSONEncoder().encode(times))

application = webapp.WSGIApplication(
    [ (r'/routes/([\w-]+)/directions/([\w-]+)/stops/([\w-]+)/times', TimeController),
      (r'/routes/([\w-]+)/directions/([\w-]+)/stops', StopsController),
      (r'/routes/([\w-]+)/directions', DirectionsController),
      (r'/routes', RoutesController) ],
    debug=False)

def main():
  run_wsgi_app(application)

if __name__ == "__main__":
  main()