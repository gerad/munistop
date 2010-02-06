from google.appengine.api import urlfetch
from BeautifulSoup import BeautifulSoup
from google.appengine.api import memcache as Memcache
import re
import logging
import cPickle as pickle

from sys import setrecursionlimit
setrecursionlimit(4000)

from collections import defaultdict

def set_trace():
  import pdb, sys
  debugger = pdb.Pdb(stdin=sys.__stdin__, stdout=sys.__stdout__)
  debugger.set_trace(sys._getframe().f_back)

timeURL = 'http://www.nextmuni.com/predictor/fancyNewPredictionLayer.jsp?a=sf-muni&r=%s&d=%s&s=%s'
listURL = "http://www.nextmuni.com/predictor/stopSelectorDataFrame.jsp?a=sf-muni"
listAttributes = [['r', 'routeSelector'],
  ['d', 'directionSelector'],
  ['s', 'stopSelector'],
  ['t', 'toStopSelector']]

def memcache(func):
  def cached(*args):
    key = pickle.dumps((func.__name__, args))
    cache = Memcache.get(key)

    if (cache):
      logging.info("cache hit for %s" % func.__name__)
      return pickle.loads(cache)

    value = func(*args)
    if (value):
      try:
        logging.info("caching results for %s" % func.__name__)
        Memcache.set(key, pickle.dumps(value), 60 * 60 * 24)
      except:
        logging.error("FAIL: caching results for %s" % func.__name__)
    return value
  return cached

def scrapeList(url):
  """the lists are all identical (in theory...)"""
  result = urlfetch.fetch(url)
  if (result.status_code == 200):
    options = re.findall(r'parent.addOption\([^)]*\)', result.content)
    d = defaultdict(list)
    for o in options:
      o = re.sub(r'\s+', ' ', o) # remove spaces
      o = re.sub(r'parent.addOption\(([^)]*)\)','\\1', o) # remove function call
      o = o.split(',')
      o = [a.strip() for a in o]
      o = [re.sub('"', '', a) for a in o]
      d[o[0]].append(o[1:3])
    return d
  else:
    return False

def scrape(*attrs):
  num_attrs = len(attrs)
  url = listURL

  for i in range(num_attrs):
    url += '&' + listAttributes[i][0] + '=' + attrs[i]

  l = scrapeList(url)

  return l[listAttributes[num_attrs][1]]

@memcache
def scrapeRoutes():
  return scrape()

@memcache
def scrapeDirections(route):
  return scrape(route)

@memcache
def scrapeStops(route, direction):
  return scrape(route, direction)

def scrapeTime(route, direction, stop):
  url = timeURL % (route, direction, stop)
  return scrapeTimeURL(url)

def scrapeTimeURL(url):
  result = urlfetch.fetch(url)
  if (result.status_code == 200):
    soup = BeautifulSoup(result.content)
    try:
      trs = soup.table.table.findAll('tr')
      times = [tr.td.span.string for tr in trs]
      times = [re.sub('&nbsp;', '', t) for t in times]
      times = [re.sub('Arriving', 'Now', t) for t in times]
      times = [re.sub('Departing', 'Now', t) for t in times]
    except:
      times = []
    return times
