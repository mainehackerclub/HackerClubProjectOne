function d3_geom_contourStart(grid) {
  var x = 0, y = 0;
  while (true) {
    if (grid(x, y)) {
      return [ x, y ];
    }
    if (x === 0) {
      x = y + 1;
      y = 0;
    } else {
      x = x - 1;
      y = y + 1;
    }
  }
}

function d3_geom_hullCCW(i1, i2, i3, v) {
  var t, a, b, c, d, e, f;
  t = v[i1];
  a = t[0];
  b = t[1];
  t = v[i2];
  c = t[0];
  d = t[1];
  t = v[i3];
  e = t[0];
  f = t[1];
  return (f - b) * (c - a) - (d - b) * (e - a) > 0;
}

function d3_geom_polygonInside(p, a, b) {
  return (b[0] - a[0]) * (p[1] - a[1]) < (b[1] - a[1]) * (p[0] - a[0]);
}

function d3_geom_polygonIntersect(c, d, a, b) {
  var x1 = c[0], x2 = d[0], x3 = a[0], x4 = b[0], y1 = c[1], y2 = d[1], y3 = a[1], y4 = b[1], x13 = x1 - x3, x21 = x2 - x1, x43 = x4 - x3, y13 = y1 - y3, y21 = y2 - y1, y43 = y4 - y3, ua = (x43 * y13 - y43 * x13) / (y43 * x21 - x43 * y21);
  return [ x1 + ua * x21, y1 + ua * y21 ];
}

function d3_voronoi_tessellate(vertices, callback) {
  var Sites = {
    list: vertices.map(function(v, i) {
      return {
        index: i,
        x: v[0],
        y: v[1]
      };
    }).sort(function(a, b) {
      return a.y < b.y ? -1 : a.y > b.y ? 1 : a.x < b.x ? -1 : a.x > b.x ? 1 : 0;
    }),
    bottomSite: null
  };
  var EdgeList = {
    list: [],
    leftEnd: null,
    rightEnd: null,
    init: function() {
      EdgeList.leftEnd = EdgeList.createHalfEdge(null, "l");
      EdgeList.rightEnd = EdgeList.createHalfEdge(null, "l");
      EdgeList.leftEnd.r = EdgeList.rightEnd;
      EdgeList.rightEnd.l = EdgeList.leftEnd;
      EdgeList.list.unshift(EdgeList.leftEnd, EdgeList.rightEnd);
    },
    createHalfEdge: function(edge, side) {
      return {
        edge: edge,
        side: side,
        vertex: null,
        l: null,
        r: null
      };
    },
    insert: function(lb, he) {
      he.l = lb;
      he.r = lb.r;
      lb.r.l = he;
      lb.r = he;
    },
    leftBound: function(p) {
      var he = EdgeList.leftEnd;
      do {
        he = he.r;
      } while (he != EdgeList.rightEnd && Geom.rightOf(he, p));
      he = he.l;
      return he;
    },
    del: function(he) {
      he.l.r = he.r;
      he.r.l = he.l;
      he.edge = null;
    },
    right: function(he) {
      return he.r;
    },
    left: function(he) {
      return he.l;
    },
    leftRegion: function(he) {
      return he.edge == null ? Sites.bottomSite : he.edge.region[he.side];
    },
    rightRegion: function(he) {
      return he.edge == null ? Sites.bottomSite : he.edge.region[d3_voronoi_opposite[he.side]];
    }
  };
  var Geom = {
    bisect: function(s1, s2) {
      var newEdge = {
        region: {
          l: s1,
          r: s2
        },
        ep: {
          l: null,
          r: null
        }
      };
      var dx = s2.x - s1.x, dy = s2.y - s1.y, adx = dx > 0 ? dx : -dx, ady = dy > 0 ? dy : -dy;
      newEdge.c = s1.x * dx + s1.y * dy + (dx * dx + dy * dy) * .5;
      if (adx > ady) {
        newEdge.a = 1;
        newEdge.b = dy / dx;
        newEdge.c /= dx;
      } else {
        newEdge.b = 1;
        newEdge.a = dx / dy;
        newEdge.c /= dy;
      }
      return newEdge;
    },
    intersect: function(el1, el2) {
      var e1 = el1.edge, e2 = el2.edge;
      if (!e1 || !e2 || e1.region.r == e2.region.r) {
        return null;
      }
      var d = e1.a * e2.b - e1.b * e2.a;
      if (Math.abs(d) < 1e-10) {
        return null;
      }
      var xint = (e1.c * e2.b - e2.c * e1.b) / d, yint = (e2.c * e1.a - e1.c * e2.a) / d, e1r = e1.region.r, e2r = e2.region.r, el, e;
      if (e1r.y < e2r.y || e1r.y == e2r.y && e1r.x < e2r.x) {
        el = el1;
        e = e1;
      } else {
        el = el2;
        e = e2;
      }
      var rightOfSite = xint >= e.region.r.x;
      if (rightOfSite && el.side === "l" || !rightOfSite && el.side === "r") {
        return null;
      }
      return {
        x: xint,
        y: yint
      };
    },
    rightOf: function(he, p) {
      var e = he.edge, topsite = e.region.r, rightOfSite = p.x > topsite.x;
      if (rightOfSite && he.side === "l") {
        return 1;
      }
      if (!rightOfSite && he.side === "r") {
        return 0;
      }
      if (e.a === 1) {
        var dyp = p.y - topsite.y, dxp = p.x - topsite.x, fast = 0, above = 0;
        if (!rightOfSite && e.b < 0 || rightOfSite && e.b >= 0) {
          above = fast = dyp >= e.b * dxp;
        } else {
          above = p.x + p.y * e.b > e.c;
          if (e.b < 0) {
            above = !above;
          }
          if (!above) {
            fast = 1;
          }
        }
        if (!fast) {
          var dxs = topsite.x - e.region.l.x;
          above = e.b * (dxp * dxp - dyp * dyp) < dxs * dyp * (1 + 2 * dxp / dxs + e.b * e.b);
          if (e.b < 0) {
            above = !above;
          }
        }
      } else {
        var yl = e.c - e.a * p.x, t1 = p.y - yl, t2 = p.x - topsite.x, t3 = yl - topsite.y;
        above = t1 * t1 > t2 * t2 + t3 * t3;
      }
      return he.side === "l" ? above : !above;
    },
    endPoint: function(edge, side, site) {
      edge.ep[side] = site;
      if (!edge.ep[d3_voronoi_opposite[side]]) return;
      callback(edge);
    },
    distance: function(s, t) {
      var dx = s.x - t.x, dy = s.y - t.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
  };
  var EventQueue = {
    list: [],
    insert: function(he, site, offset) {
      he.vertex = site;
      he.ystar = site.y + offset;
      for (var i = 0, list = EventQueue.list, l = list.length; i < l; i++) {
        var next = list[i];
        if (he.ystar > next.ystar || he.ystar == next.ystar && site.x > next.vertex.x) {
          continue;
        } else {
          break;
        }
      }
      list.splice(i, 0, he);
    },
    del: function(he) {
      for (var i = 0, ls = EventQueue.list, l = ls.length; i < l && ls[i] != he; ++i) {}
      ls.splice(i, 1);
    },
    empty: function() {
      return EventQueue.list.length === 0;
    },
    nextEvent: function(he) {
      for (var i = 0, ls = EventQueue.list, l = ls.length; i < l; ++i) {
        if (ls[i] == he) return ls[i + 1];
      }
      return null;
    },
    min: function() {
      var elem = EventQueue.list[0];
      return {
        x: elem.vertex.x,
        y: elem.ystar
      };
    },
    extractMin: function() {
      return EventQueue.list.shift();
    }
  };
  EdgeList.init();
  Sites.bottomSite = Sites.list.shift();
  var newSite = Sites.list.shift(), newIntStar;
  var lbnd, rbnd, llbnd, rrbnd, bisector;
  var bot, top, temp, p, v;
  var e, pm;
  while (true) {
    if (!EventQueue.empty()) {
      newIntStar = EventQueue.min();
    }
    if (newSite && (EventQueue.empty() || newSite.y < newIntStar.y || newSite.y == newIntStar.y && newSite.x < newIntStar.x)) {
      lbnd = EdgeList.leftBound(newSite);
      rbnd = EdgeList.right(lbnd);
      bot = EdgeList.rightRegion(lbnd);
      e = Geom.bisect(bot, newSite);
      bisector = EdgeList.createHalfEdge(e, "l");
      EdgeList.insert(lbnd, bisector);
      p = Geom.intersect(lbnd, bisector);
      if (p) {
        EventQueue.del(lbnd);
        EventQueue.insert(lbnd, p, Geom.distance(p, newSite));
      }
      lbnd = bisector;
      bisector = EdgeList.createHalfEdge(e, "r");
      EdgeList.insert(lbnd, bisector);
      p = Geom.intersect(bisector, rbnd);
      if (p) {
        EventQueue.insert(bisector, p, Geom.distance(p, newSite));
      }
      newSite = Sites.list.shift();
    } else if (!EventQueue.empty()) {
      lbnd = EventQueue.extractMin();
      llbnd = EdgeList.left(lbnd);
      rbnd = EdgeList.right(lbnd);
      rrbnd = EdgeList.right(rbnd);
      bot = EdgeList.leftRegion(lbnd);
      top = EdgeList.rightRegion(rbnd);
      v = lbnd.vertex;
      Geom.endPoint(lbnd.edge, lbnd.side, v);
      Geom.endPoint(rbnd.edge, rbnd.side, v);
      EdgeList.del(lbnd);
      EventQueue.del(rbnd);
      EdgeList.del(rbnd);
      pm = "l";
      if (bot.y > top.y) {
        temp = bot;
        bot = top;
        top = temp;
        pm = "r";
      }
      e = Geom.bisect(bot, top);
      bisector = EdgeList.createHalfEdge(e, pm);
      EdgeList.insert(llbnd, bisector);
      Geom.endPoint(e, d3_voronoi_opposite[pm], v);
      p = Geom.intersect(llbnd, bisector);
      if (p) {
        EventQueue.del(llbnd);
        EventQueue.insert(llbnd, p, Geom.distance(p, bot));
      }
      p = Geom.intersect(bisector, rrbnd);
      if (p) {
        EventQueue.insert(bisector, p, Geom.distance(p, bot));
      }
    } else {
      break;
    }
  }
  for (lbnd = EdgeList.right(EdgeList.leftEnd); lbnd != EdgeList.rightEnd; lbnd = EdgeList.right(lbnd)) {
    callback(lbnd.edge);
  }
}

function d3_geom_quadtreeNode() {
  return {
    leaf: true,
    nodes: [],
    point: null
  };
}

function d3_geom_quadtreeVisit(f, node, x1, y1, x2, y2) {
  if (!f(node, x1, y1, x2, y2)) {
    var sx = (x1 + x2) * .5, sy = (y1 + y2) * .5, children = node.nodes;
    if (children[0]) d3_geom_quadtreeVisit(f, children[0], x1, y1, sx, sy);
    if (children[1]) d3_geom_quadtreeVisit(f, children[1], sx, y1, x2, sy);
    if (children[2]) d3_geom_quadtreeVisit(f, children[2], x1, sy, sx, y2);
    if (children[3]) d3_geom_quadtreeVisit(f, children[3], sx, sy, x2, y2);
  }
}

function d3_geom_quadtreePoint(p) {
  return {
    x: p[0],
    y: p[1]
  };
}

d3.geom = {};

d3.geom.contour = function(grid, start) {
  var s = start || d3_geom_contourStart(grid), c = [], x = s[0], y = s[1], dx = 0, dy = 0, pdx = NaN, pdy = NaN, i = 0;
  do {
    i = 0;
    if (grid(x - 1, y - 1)) i += 1;
    if (grid(x, y - 1)) i += 2;
    if (grid(x - 1, y)) i += 4;
    if (grid(x, y)) i += 8;
    if (i === 6) {
      dx = pdy === -1 ? -1 : 1;
      dy = 0;
    } else if (i === 9) {
      dx = 0;
      dy = pdx === 1 ? -1 : 1;
    } else {
      dx = d3_geom_contourDx[i];
      dy = d3_geom_contourDy[i];
    }
    if (dx != pdx && dy != pdy) {
      c.push([ x, y ]);
      pdx = dx;
      pdy = dy;
    }
    x += dx;
    y += dy;
  } while (s[0] != x || s[1] != y);
  return c;
};

var d3_geom_contourDx = [ 1, 0, 1, 1, -1, 0, -1, 1, 0, 0, 0, 0, -1, 0, -1, NaN ], d3_geom_contourDy = [ 0, -1, 0, 0, 0, -1, 0, 0, 1, -1, 1, 1, 0, -1, 0, NaN ];

d3.geom.hull = function(vertices) {
  if (vertices.length < 3) return [];
  var len = vertices.length, plen = len - 1, points = [], stack = [], i, j, h = 0, x1, y1, x2, y2, u, v, a, sp;
  for (i = 1; i < len; ++i) {
    if (vertices[i][1] < vertices[h][1]) {
      h = i;
    } else if (vertices[i][1] == vertices[h][1]) {
      h = vertices[i][0] < vertices[h][0] ? i : h;
    }
  }
  for (i = 0; i < len; ++i) {
    if (i === h) continue;
    y1 = vertices[i][1] - vertices[h][1];
    x1 = vertices[i][0] - vertices[h][0];
    points.push({
      angle: Math.atan2(y1, x1),
      index: i
    });
  }
  points.sort(function(a, b) {
    return a.angle - b.angle;
  });
  a = points[0].angle;
  v = points[0].index;
  u = 0;
  for (i = 1; i < plen; ++i) {
    j = points[i].index;
    if (a == points[i].angle) {
      x1 = vertices[v][0] - vertices[h][0];
      y1 = vertices[v][1] - vertices[h][1];
      x2 = vertices[j][0] - vertices[h][0];
      y2 = vertices[j][1] - vertices[h][1];
      if (x1 * x1 + y1 * y1 >= x2 * x2 + y2 * y2) {
        points[i].index = -1;
      } else {
        points[u].index = -1;
        a = points[i].angle;
        u = i;
        v = j;
      }
    } else {
      a = points[i].angle;
      u = i;
      v = j;
    }
  }
  stack.push(h);
  for (i = 0, j = 0; i < 2; ++j) {
    if (points[j].index !== -1) {
      stack.push(points[j].index);
      i++;
    }
  }
  sp = stack.length;
  for (; j < plen; ++j) {
    if (points[j].index === -1) continue;
    while (!d3_geom_hullCCW(stack[sp - 2], stack[sp - 1], points[j].index, vertices)) {
      --sp;
    }
    stack[sp++] = points[j].index;
  }
  var poly = [];
  for (i = 0; i < sp; ++i) {
    poly.push(vertices[stack[i]]);
  }
  return poly;
};

d3.geom.polygon = function(coordinates) {
  coordinates.area = function() {
    var i = 0, n = coordinates.length, a = coordinates[n - 1][0] * coordinates[0][1], b = coordinates[n - 1][1] * coordinates[0][0];
    while (++i < n) {
      a += coordinates[i - 1][0] * coordinates[i][1];
      b += coordinates[i - 1][1] * coordinates[i][0];
    }
    return (b - a) * .5;
  };
  coordinates.centroid = function(k) {
    var i = -1, n = coordinates.length, x = 0, y = 0, a, b = coordinates[n - 1], c;
    if (!arguments.length) k = -1 / (6 * coordinates.area());
    while (++i < n) {
      a = b;
      b = coordinates[i];
      c = a[0] * b[1] - b[0] * a[1];
      x += (a[0] + b[0]) * c;
      y += (a[1] + b[1]) * c;
    }
    return [ x * k, y * k ];
  };
  coordinates.clip = function(subject) {
    var input, i = -1, n = coordinates.length, j, m, a = coordinates[n - 1], b, c, d;
    while (++i < n) {
      input = subject.slice();
      subject.length = 0;
      b = coordinates[i];
      c = input[(m = input.length) - 1];
      j = -1;
      while (++j < m) {
        d = input[j];
        if (d3_geom_polygonInside(d, a, b)) {
          if (!d3_geom_polygonInside(c, a, b)) {
            subject.push(d3_geom_polygonIntersect(c, d, a, b));
          }
          subject.push(d);
        } else if (d3_geom_polygonInside(c, a, b)) {
          subject.push(d3_geom_polygonIntersect(c, d, a, b));
        }
        c = d;
      }
      a = b;
    }
    return subject;
  };
  return coordinates;
};

d3.geom.voronoi = function(vertices) {
  var polygons = vertices.map(function() {
    return [];
  });
  d3_voronoi_tessellate(vertices, function(e) {
    var s1, s2, x1, x2, y1, y2;
    if (e.a === 1 && e.b >= 0) {
      s1 = e.ep.r;
      s2 = e.ep.l;
    } else {
      s1 = e.ep.l;
      s2 = e.ep.r;
    }
    if (e.a === 1) {
      y1 = s1 ? s1.y : -1e6;
      x1 = e.c - e.b * y1;
      y2 = s2 ? s2.y : 1e6;
      x2 = e.c - e.b * y2;
    } else {
      x1 = s1 ? s1.x : -1e6;
      y1 = e.c - e.a * x1;
      x2 = s2 ? s2.x : 1e6;
      y2 = e.c - e.a * x2;
    }
    var v1 = [ x1, y1 ], v2 = [ x2, y2 ];
    polygons[e.region.l.index].push(v1, v2);
    polygons[e.region.r.index].push(v1, v2);
  });
  return polygons.map(function(polygon, i) {
    var cx = vertices[i][0], cy = vertices[i][1];
    polygon.forEach(function(v) {
      v.angle = Math.atan2(v[0] - cx, v[1] - cy);
    });
    return polygon.sort(function(a, b) {
      return a.angle - b.angle;
    }).filter(function(d, i) {
      return !i || d.angle - polygon[i - 1].angle > 1e-10;
    });
  });
};

var d3_voronoi_opposite = {
  l: "r",
  r: "l"
};

d3.geom.delaunay = function(vertices) {
  var edges = vertices.map(function() {
    return [];
  }), triangles = [];
  d3_voronoi_tessellate(vertices, function(e) {
    edges[e.region.l.index].push(vertices[e.region.r.index]);
  });
  edges.forEach(function(edge, i) {
    var v = vertices[i], cx = v[0], cy = v[1];
    edge.forEach(function(v) {
      v.angle = Math.atan2(v[0] - cx, v[1] - cy);
    });
    edge.sort(function(a, b) {
      return a.angle - b.angle;
    });
    for (var j = 0, m = edge.length - 1; j < m; j++) {
      triangles.push([ v, edge[j], edge[j + 1] ]);
    }
  });
  return triangles;
};

d3.geom.quadtree = function(points, x1, y1, x2, y2) {
  function insert(n, p, x1, y1, x2, y2) {
    if (isNaN(p.x) || isNaN(p.y)) return;
    if (n.leaf) {
      var v = n.point;
      if (v) {
        if (Math.abs(v.x - p.x) + Math.abs(v.y - p.y) < .01) {
          insertChild(n, p, x1, y1, x2, y2);
        } else {
          n.point = null;
          insertChild(n, v, x1, y1, x2, y2);
          insertChild(n, p, x1, y1, x2, y2);
        }
      } else {
        n.point = p;
      }
    } else {
      insertChild(n, p, x1, y1, x2, y2);
    }
  }
  function insertChild(n, p, x1, y1, x2, y2) {
    var sx = (x1 + x2) * .5, sy = (y1 + y2) * .5, right = p.x >= sx, bottom = p.y >= sy, i = (bottom << 1) + right;
    n.leaf = false;
    n = n.nodes[i] || (n.nodes[i] = d3_geom_quadtreeNode());
    if (right) x1 = sx; else x2 = sx;
    if (bottom) y1 = sy; else y2 = sy;
    insert(n, p, x1, y1, x2, y2);
  }
  var p, i = -1, n = points.length;
  if (n && isNaN(points[0].x)) points = points.map(d3_geom_quadtreePoint);
  if (arguments.length < 5) {
    if (arguments.length === 3) {
      y2 = x2 = y1;
      y1 = x1;
    } else {
      x1 = y1 = Infinity;
      x2 = y2 = -Infinity;
      while (++i < n) {
        p = points[i];
        if (p.x < x1) x1 = p.x;
        if (p.y < y1) y1 = p.y;
        if (p.x > x2) x2 = p.x;
        if (p.y > y2) y2 = p.y;
      }
      var dx = x2 - x1, dy = y2 - y1;
      if (dx > dy) y2 = y1 + dx; else x2 = x1 + dy;
    }
  }
  var root = d3_geom_quadtreeNode();
  root.add = function(p) {
    insert(root, p, x1, y1, x2, y2);
  };
  root.visit = function(f) {
    d3_geom_quadtreeVisit(f, root, x1, y1, x2, y2);
  };
  points.forEach(root.add);
  return root;
};